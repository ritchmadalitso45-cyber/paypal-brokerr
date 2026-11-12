from datetime import timedelta
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import func, select

from copilot.config import Settings
from copilot.database import Alert, Job, Workflow, now
from copilot.providers import Connectors, PayPal, ProviderError
from copilot.services import enqueue, scan_overdue, upsert_transaction
from copilot.worker import claim_job, process_job


async def test_paypal_oauth_and_signature_protocol():
    requests = []

    def handle(request):
        requests.append(request)
        if request.url.path == "/v1/oauth2/token":
            assert b"grant_type=client_credentials" in request.content
            assert request.headers["authorization"].startswith("Basic ")
            return httpx.Response(200, json={"access_token": "access", "expires_in": 3600})
        assert request.headers["authorization"] == "Bearer access"
        assert request.url.path == "/v1/notifications/verify-webhook-signature"
        return httpx.Response(200, json={"verification_status": "SUCCESS"})

    settings = Settings(
        _env_file=None,
        paypal_client_id="client",
        paypal_client_secret="secret",
        paypal_webhook_id="WH-ID",
    )
    headers = {
        name: "test"
        for name in [
            "paypal-auth-algo",
            "paypal-cert-url",
            "paypal-transmission-id",
            "paypal-transmission-sig",
            "paypal-transmission-time",
        ]
    }
    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        paypal = PayPal(settings, client)
        assert await paypal.verify_webhook(headers, {"id": "WH-1"})
        assert await paypal.verify_webhook(headers, {"id": "WH-2"})
    assert len(requests) == 3  # Token reused across verifications.


async def test_paypal_does_not_retry_writes():
    count = 0

    def handle(request):
        nonlocal count
        count += 1
        return httpx.Response(503)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        paypal = PayPal(Settings(_env_file=None), client)
        paypal.token, paypal.expiry = "access", float("inf")
        with pytest.raises(ProviderError):
            await paypal.request("POST", "/v2/invoicing/invoices/X/remind", payload={})
    assert count == 1


def test_overdue_jobs_deduplicate_and_automation_is_opt_in(client):
    from test_api import seed

    seed(client)
    with client.app.state.factory() as db:
        db.add(Workflow(event="invoice.overdue", destination="zapier"))
        db.commit()
        scan_overdue(db, False)
        scan_overdue(db, False)
        assert db.scalar(select(func.count()).select_from(Job).where(Job.kind == "deliver")) == 1
        assert db.scalar(select(func.count()).select_from(Job).where(Job.kind == "reminder")) == 0
        scan_overdue(db, True)
        scan_overdue(db, True)
        assert db.scalar(select(func.count()).select_from(Job).where(Job.kind == "reminder")) == 1


def test_queue_claim_and_abandoned_job_recovery(client):
    with client.app.state.factory() as db:
        job = enqueue(db, "sync", {}, "test-job")
        db.commit()
        job_id = job.id
    assert claim_job(client.app.state.factory) == job_id
    assert claim_job(client.app.state.factory) is None
    with client.app.state.factory() as db:
        db.get(Job, job_id).locked_at = now() - timedelta(hours=1)
        db.commit()
    assert claim_job(client.app.state.factory) == job_id


def test_anomalies_and_index_outbox_are_idempotent(client):
    settings = client.app.state.settings
    settings.elastic_url = "https://elastic.example.com"
    with client.app.state.factory() as db:
        for index in range(5):
            data = {
                "transaction_info": {
                    "transaction_id": f"TX-{index}",
                    "transaction_status": "S",
                    "transaction_amount": {"value": "9500", "currency_code": "USD"},
                    "transaction_event_code": "T0006",
                    "transaction_initiation_date": "2026-01-01T12:00:00Z",
                },
                "payer_info": {"country_code": "NG"},
            }
            upsert_transaction(db, data, settings)
        upsert_transaction(db, data, settings)
        db.commit()
        assert (
            db.scalar(select(func.count()).select_from(Alert).where(Alert.id.like("%:velocity")))
            == 1
        )
        assert (
            db.scalar(select(func.count()).select_from(Alert).where(Alert.id.like("%:country")))
            == 5
        )
        assert db.scalar(select(func.count()).select_from(Job).where(Job.kind == "index")) == 5


async def test_connector_worker_dispatch(client):
    connectors = AsyncMock(spec=Connectors)
    with client.app.state.factory() as db:
        job = Job(
            kind="deliver",
            dedupe_key="delivery",
            payload={
                "destination": "zapier",
                "event": "invoice.overdue",
                "resource_id": "INV-1",
                "event_id": "event-1",
            },
        )
        await process_job(db, job, AsyncMock(), connectors, client.app.state.settings)
        connectors.deliver.assert_awaited_once_with("zapier", job.payload)


def test_production_requires_shared_infrastructure():
    with pytest.raises(ValueError):
        Settings(_env_file=None, environment="production", admin_api_key="x" * 40)
