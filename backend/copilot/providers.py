"""Bounded outbound HTTP adapters. Secrets and provider bodies never enter error responses."""

import asyncio
import time
from urllib.parse import quote

import httpx


class ProviderError(Exception):
    def __init__(self, provider, status=502):
        self.provider = provider
        self.status = status
        super().__init__(f"{provider} request failed")


def segment(value):
    return quote(value, safe="")


class PayPal:
    def __init__(self, settings, client):
        self.settings = settings
        self.client = client
        self.base = (
            "https://api-m.paypal.com"
            if settings.paypal_environment == "live"
            else "https://api-m.sandbox.paypal.com"
        )
        self.token = ""
        self.expiry = 0
        self.lock = asyncio.Lock()

    async def access_token(self):
        async with self.lock:
            if self.token and self.expiry > time.monotonic():
                return self.token
            if not self.settings.paypal_client_id.get_secret_value():
                raise ProviderError("PayPal is not configured", 503)
            response = await self.client.post(
                self.base + "/v1/oauth2/token",
                auth=(
                    self.settings.paypal_client_id.get_secret_value(),
                    self.settings.paypal_client_secret.get_secret_value(),
                ),
                data={"grant_type": "client_credentials"},
            )
            if response.is_error:
                raise ProviderError("PayPal authentication")
            data = response.json()
            self.token = data["access_token"]
            self.expiry = time.monotonic() + max(0, int(data["expires_in"]) - 60)
            return self.token

    async def request(self, method, path, *, payload=None, params=None, request_id=None):
        headers = {
            "Authorization": f"Bearer {await self.access_token()}",
            "Prefer": "return=representation",
        }
        if request_id:
            headers["PayPal-Request-Id"] = request_id
        # Retry only reads; uncertain writes require reconciliation, never a blind replay.
        for attempt in range(3 if method == "GET" else 1):
            try:
                response = await self.client.request(
                    method, self.base + path, headers=headers, json=payload, params=params
                )
            except httpx.HTTPError as exc:
                raise ProviderError("PayPal") from exc
            if (
                method == "GET"
                and response.status_code in {429, 500, 502, 503, 504}
                and attempt < 2
            ):
                await asyncio.sleep(0.25 * 2**attempt)
                continue
            if response.is_error:
                raise ProviderError("PayPal", 404 if response.status_code == 404 else 502)
            return response.json() if response.content else {"accepted": True}

    async def verify_webhook(self, headers, event):
        fields = {
            "auth_algo": "paypal-auth-algo",
            "cert_url": "paypal-cert-url",
            "transmission_id": "paypal-transmission-id",
            "transmission_sig": "paypal-transmission-sig",
            "transmission_time": "paypal-transmission-time",
        }
        if not self.settings.paypal_webhook_id or any(not headers.get(x) for x in fields.values()):
            return False
        payload = {key: headers[value] for key, value in fields.items()}
        payload.update(webhook_id=self.settings.paypal_webhook_id, webhook_event=event)
        result = await self.request(
            "POST", "/v1/notifications/verify-webhook-signature", payload=payload
        )
        return result.get("verification_status") == "SUCCESS"


class Connectors:
    def __init__(self, settings, client):
        self.settings = settings
        self.client = client

    async def deliver(self, destination, payload):
        url = getattr(self.settings, f"{destination}_webhook_url").get_secret_value()
        if not url:
            raise ProviderError(f"{destination} is not configured", 503)
        body = (
            {"text": f"PayPal Broker: {payload['event']} | Reference: {payload['resource_id']}"}
            if destination == "slack"
            else payload
        )
        try:
            response = await self.client.post(url, json=body)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(destination) from exc

    async def index_transaction(self, transaction):
        if not self.settings.elastic_url:
            return
        response = await self.client.put(
            self.settings.elastic_url.rstrip("/")
            + "/copilot-transactions/_doc/"
            + segment(transaction["id"]),
            headers={"Authorization": "ApiKey " + self.settings.elastic_api_key.get_secret_value()},
            json=transaction,
        )
        if response.is_error:
            raise ProviderError("Elastic")

    async def search_transactions(self, query, offset, limit):
        if not self.settings.elastic_url:
            raise ProviderError("Elastic is not configured", 503)
        response = await self.client.post(
            self.settings.elastic_url.rstrip("/") + "/copilot-transactions/_search",
            headers={"Authorization": "ApiKey " + self.settings.elastic_api_key.get_secret_value()},
            json={
                "from": offset,
                "size": limit,
                "query": {
                    "simple_query_string": {
                        "query": query,
                        "fields": ["id", "status", "country", "event_code"],
                        "flags": "NONE",
                    }
                },
            },
        )
        if response.is_error:
            raise ProviderError("Elastic")
        return response.json()
