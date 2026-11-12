from datetime import timedelta
from decimal import Decimal
from unittest.mock import AsyncMock

from sqlalchemy import func, select

from copilot.database import Invoice, Job, Operation, WebhookEvent, now
from copilot.providers import ProviderError


def seed(client, status="SENT"):
    with client.app.state.factory() as db:
        db.add(
            Invoice(
                id="INV-1",
                customer="client@example.com",
                status=status,
                currency="GBP",
                amount=Decimal("100"),
                outstanding=Decimal("100"),
                due_date="2020-01-01",
            )
        )
        db.commit()


def canonical(status="SENT"):
    return {
        "id": "INV-1",
        "status": status,
        "amount": {"value": "100.00", "currency_code": "GBP"},
        "detail": {"payment_term": {"due_date": "2020-01-01"}},
    }


def proposal(client, admin, key="reminder-1234"):
    response = client.post(
        "/api/v1/invoices/INV-1/reminders",
        headers={**admin, "Idempotency-Key": key},
        json={"note": "Please pay your invoice."},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_auth_and_role_boundaries(client, admin, viewer):
    assert client.get("/health/ready").status_code == 200
    assert client.get("/api/v1/dashboard").status_code == 401
    assert client.get("/api/v1/dashboard", headers=viewer).status_code == 200
    assert (
        client.post(
            "/api/v1/invoices/INV-1/reminders", headers=viewer, json={"note": "hello"}
        ).status_code
        == 403
    )
    assert client.get("/api/v1/audit", headers=viewer).status_code == 403
    assert client.get("/api/v1/openapi.json", headers=admin).status_code == 200


def test_multicurrency_and_overdue_filter(client, admin):
    seed(client)
    with client.app.state.factory() as db:
        db.add(
            Invoice(
                id="INV-2",
                customer="x",
                status="SENT",
                currency="USD",
                amount=50,
                outstanding=50,
                due_date="2099-01-01",
            )
        )
        db.commit()
    summary = client.get("/api/v1/dashboard", headers=admin).json()
    assert Decimal(str(summary["outstanding_by_currency"]["GBP"])) == 100
    assert Decimal(str(summary["outstanding_by_currency"]["USD"])) == 50
    assert set(summary["overdue_by_currency"]) == {"GBP"}
    assert len(client.get("/api/v1/invoices?overdue=true", headers=admin).json()["items"]) == 1
    assert client.get("/api/v1/invoices?limit=50000", headers=admin).status_code == 422


def test_proposal_does_not_send_and_key_conflict(client, admin):
    client.app.state.paypal.request = AsyncMock()
    first = proposal(client, admin)
    assert proposal(client, admin)["id"] == first["id"]
    client.app.state.paypal.request.assert_not_called()
    response = client.post(
        "/api/v1/invoices/INV-1/reminders",
        headers={**admin, "Idempotency-Key": "reminder-1234"},
        json={"note": "Different note"},
    )
    assert response.status_code == 409


def test_approval_sends_once(client, admin):
    seed(client)
    client.app.state.paypal.request = AsyncMock(side_effect=[canonical(), {"accepted": True}])
    item = proposal(client, admin)
    path = f"/api/v1/operations/{item['id']}/approve"
    assert client.post(path, headers=admin).json()["status"] == "succeeded"
    assert client.post(path, headers=admin).json()["status"] == "succeeded"
    assert client.app.state.paypal.request.await_count == 2
    second = proposal(client, admin, "reminder-5678")
    client.app.state.paypal.request = AsyncMock(return_value=canonical())
    assert (
        client.post(f"/api/v1/operations/{second['id']}/approve", headers=admin).status_code == 409
    )


def test_paid_invoice_and_expired_proposal_blocked(client, admin):
    seed(client)
    item = proposal(client, admin)
    client.app.state.paypal.request = AsyncMock(return_value=canonical("PAID"))
    path = f"/api/v1/operations/{item['id']}/approve"
    assert client.post(path, headers=admin).status_code == 409
    with client.app.state.factory() as db:
        db.get(Operation, item["id"]).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.post(path, headers=admin).status_code == 409
    assert client.app.state.paypal.request.await_count == 1


def test_uncertain_write_never_retried(client, admin):
    seed(client)
    client.app.state.paypal.request = AsyncMock(side_effect=[canonical(), ProviderError("PayPal")])
    item = proposal(client, admin)
    path = f"/api/v1/operations/{item['id']}/approve"
    assert client.post(path, headers=admin).status_code == 502
    assert client.post(path, headers=admin).status_code == 409
    assert client.app.state.paypal.request.await_count == 2
    with client.app.state.factory() as db:
        assert db.get(Operation, item["id"]).status == "unknown"


def test_signed_webhook_replay_is_deduplicated(client):
    client.app.state.paypal.verify_webhook = AsyncMock(return_value=True)
    event = {"id": "WH-1", "event_type": "PAYMENT.CAPTURE.COMPLETED", "resource": {"id": "PAY-1"}}
    assert client.post("/api/v1/webhooks/paypal", json=event).status_code == 202
    assert client.post("/api/v1/webhooks/paypal", json=event).json()["duplicate"]
    with client.app.state.factory() as db:
        assert db.scalar(select(func.count()).select_from(WebhookEvent)) == 1
        assert db.scalar(select(func.count()).select_from(Job)) == 1


def test_invalid_webhook_never_persisted(client):
    event = {"id": "WH-2", "event_type": "PAYMENT.CAPTURE.COMPLETED"}
    assert client.post("/api/v1/webhooks/paypal", json=event).status_code == 401
    assert client.post("/api/v1/webhooks/paypal", content="[]").status_code == 422
    with client.app.state.factory() as db:
        assert db.scalar(select(func.count()).select_from(WebhookEvent)) == 0


def test_missing_configuration_and_body_limit(client, admin):
    assert (
        client.post(
            "/api/v1/agent/chat", headers=admin, json={"message": "Who owes me?"}
        ).status_code
        == 503
    )
    assert client.post("/api/v1/agent/chat", headers=admin, content="x" * 262145).status_code == 413
    assert (
        client.post(
            "/api/v1/workflows",
            headers=admin,
            json={"event": "invoice.overdue", "destination": "slack"},
        ).status_code
        == 409
    )


def test_sync_idempotency_and_date_validation(client, admin):
    headers = {**admin, "Idempotency-Key": "sync-12345"}
    body = {"start": "2025-01-01", "end": "2025-01-02"}
    first = client.post("/api/v1/sync", headers=headers, json=body)
    assert first.status_code == 202
    assert (
        client.post("/api/v1/sync", headers=headers, json=body).json()["job_id"]
        == first.json()["job_id"]
    )
    assert (
        client.post(
            "/api/v1/sync", headers=headers, json={"start": "2025-01-01", "end": "2025-01-03"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/sync", headers=headers, json={"start": "2025-01-01", "end": "2025-05-01"}
        ).status_code
        == 422
    )
