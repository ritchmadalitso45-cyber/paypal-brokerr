import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from copilot.database import Alert, Audit, Invoice, Job, Operation, Transaction, Workflow, now
from copilot.providers import segment

UNPAID = {"SENT", "UNPAID", "PARTIALLY_PAID", "PAYMENT_PENDING", "MARKED_AS_UNPAID"}


def serialize(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def enqueue(db, kind, payload, key):
    existing = db.scalar(select(Job).where(Job.dedupe_key == key))
    if existing:
        return existing
    job = Job(kind=kind, payload=payload, dedupe_key=key)
    # Savepoint allows duplicate deliveries to race without rolling back their caller.
    try:
        with db.begin_nested():
            db.add(job)
            db.flush()
    except IntegrityError:
        return db.scalar(select(Job).where(Job.dedupe_key == key))
    return job


def emit(db, event, resource_id, event_id):
    for workflow in db.scalars(
        select(Workflow).where(Workflow.event == event, Workflow.enabled.is_(True))
    ):
        enqueue(
            db,
            "deliver",
            {
                "destination": workflow.destination,
                "event": event,
                "resource_id": resource_id,
                "event_id": event_id,
            },
            f"workflow:{workflow.id}:{event_id}",
        )


def overdue_query():
    return select(Invoice).where(
        Invoice.status.in_(UNPAID),
        Invoice.outstanding > 0,
        Invoice.due_date < now().date().isoformat(),
    )


def dashboard(db):
    # Never add currencies together or classify all PayPal movements as revenue.
    balances = db.execute(
        select(Invoice.currency, func.sum(Invoice.outstanding))
        .where(Invoice.status.in_(UNPAID))
        .group_by(Invoice.currency)
    ).all()
    overdue = db.execute(
        select(Invoice.currency, func.sum(Invoice.outstanding))
        .where(Invoice.id.in_(overdue_query().with_only_columns(Invoice.id)))
        .group_by(Invoice.currency)
    ).all()
    return {
        "outstanding_by_currency": dict(balances),
        "overdue_by_currency": dict(overdue),
        "invoice_count": db.scalar(select(func.count()).select_from(Invoice)),
        "transaction_count": db.scalar(select(func.count()).select_from(Transaction)),
        "alert_count": db.scalar(select(func.count()).select_from(Alert)),
        "as_of": now(),
    }


def upsert_invoice(db, data):
    invoice_id = data["id"]
    amount = data.get("amount", {})
    status = data.get("status", "DRAFT")
    recipients = data.get("primary_recipients", [])
    customer = recipients[0].get("billing_info", {}).get("email_address", "") if recipients else ""
    due = data.get("detail", {}).get("payment_term", {}).get("due_date")
    # A missing partial balance cannot safely be inferred from gross invoice value.
    due_amount = data.get("due_amount", {}).get("value")
    if status == "PARTIALLY_PAID" and due_amount is None:
        raise ValueError("Partial invoice missing canonical due amount")
    outstanding = (
        Decimal(str(due_amount if due_amount is not None else amount.get("value", "0")))
        if status in UNPAID
        else Decimal("0")
    )
    row = db.get(Invoice, invoice_id) or Invoice(id=invoice_id)
    row.status, row.customer = status, customer
    row.amount = Decimal(str(amount.get("value", "0")))
    row.outstanding = outstanding
    row.currency = amount.get("currency_code", "USD")
    row.due_date, row.updated_at = due, now()
    db.add(row)
    return row


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC).replace(tzinfo=None)


def upsert_transaction(db, data, settings):
    info = data["transaction_info"]
    transaction_id = info["transaction_id"]
    row = db.get(Transaction, transaction_id) or Transaction(id=transaction_id)
    row.status = info.get("transaction_status", "UNKNOWN")
    row.amount = Decimal(info["transaction_amount"]["value"])
    row.currency = info["transaction_amount"]["currency_code"]
    row.country = data.get("payer_info", {}).get("country_code", "")
    row.event_code = info.get("transaction_event_code", "")
    row.occurred_at = parse_time(info["transaction_initiation_date"])
    db.add(row)
    db.flush()
    reasons = []
    if abs(row.amount) >= settings.high_value_threshold:
        reasons.append(
            ("high_value", "Amount exceeds the configured per-currency screening threshold")
        )
    if row.country and row.country not in settings.allowed_countries.split(","):
        reasons.append(("country", "Payer country is outside the configured business countries"))
    velocity = db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(
            Transaction.currency == row.currency,
            Transaction.country == row.country,
            Transaction.occurred_at >= row.occurred_at - timedelta(minutes=10),
            Transaction.occurred_at <= row.occurred_at,
            Transaction.amount >= Decimal(settings.high_value_threshold) * Decimal("0.9"),
            Transaction.amount < settings.high_value_threshold,
        )
    )
    if velocity >= 5:
        reasons.append(
            (
                "velocity",
                "Five or more near-threshold account movements in ten minutes from the same country; review context",
            )
        )
    # T1107 identifies a refund in PayPal transaction reporting.
    if row.event_code == "T1107":
        refund_query = (
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.currency == row.currency, Transaction.event_code == "T1107")
        )
        recent = db.scalar(
            refund_query.where(
                Transaction.occurred_at >= row.occurred_at - timedelta(hours=2),
                Transaction.occurred_at <= row.occurred_at,
            )
        )
        baseline = db.scalar(
            refund_query.where(
                Transaction.occurred_at >= row.occurred_at - timedelta(days=7),
                Transaction.occurred_at < row.occurred_at - timedelta(hours=2),
            )
        )
        if recent >= 5 and recent > max(1, baseline / 83) * 3:
            reasons.append(
                (
                    "refund_spike",
                    "Refund count in two hours exceeds three times the preceding seven-day hourly baseline",
                )
            )
    for rule, reason in reasons:
        alert_id = f"{transaction_id}:{rule}"
        if not db.get(Alert, alert_id):
            db.add(
                Alert(id=alert_id, severity="review", reason=reason, transaction_id=transaction_id)
            )
            emit(db, "alert.created", transaction_id, alert_id)
    document = {
        "id": row.id,
        "status": row.status,
        "amount": str(row.amount),
        "currency": row.currency,
        "country": row.country,
        "event_code": row.event_code,
        "occurred_at": row.occurred_at.isoformat() + "Z",
    }
    digest = hashlib.sha256(json.dumps(document, sort_keys=True).encode()).hexdigest()[:16]
    if settings.elastic_url:
        enqueue(db, "index", document, f"index:{row.id}:{digest}")


def propose(db, key, kind, resource_id, payload, actor="admin"):
    digest = hashlib.sha256(
        json.dumps([kind, resource_id, payload], sort_keys=True).encode()
    ).hexdigest()
    existing = db.scalar(select(Operation).where(Operation.key == key))
    if existing:
        if existing.digest != digest:
            raise HTTPException(409, "Idempotency key was already used with a different request")
        return existing
    operation = Operation(
        key=key,
        digest=digest,
        kind=kind,
        resource_id=resource_id,
        payload=payload,
        expires_at=now() + timedelta(minutes=15),
    )
    try:
        with db.begin_nested():
            db.add(operation)
            db.flush()
    except IntegrityError:
        existing = db.scalar(select(Operation).where(Operation.key == key))
        if existing.digest != digest:
            raise HTTPException(409, "Idempotency key conflict") from None
        return existing
    db.add(Audit(action="operation.proposed", resource_id=operation.id, actor=actor, detail=kind))
    db.commit()
    return operation


async def execute_operation(db, operation_id, paypal, settings, actor="admin"):
    operation = db.get(Operation, operation_id)
    if not operation:
        raise HTTPException(404, "Operation not found")
    if operation.status == "succeeded":
        return serialize(operation)
    if operation.status != "proposed":
        raise HTTPException(409, "Operation is in progress or needs manual reconciliation")
    if operation.expires_at < now():
        raise HTTPException(409, "Proposal expired; create a new proposal")
    if operation.kind == "reminder":
        # Canonical fetch prevents a stale local row from reminding an already-paid invoice.
        canonical = await paypal.request(
            "GET", f"/v2/invoicing/invoices/{segment(operation.resource_id)}"
        )
        invoice = upsert_invoice(db, canonical)
        if invoice.status not in UNPAID or invoice.outstanding <= 0:
            db.commit()
            raise HTTPException(409, "Invoice has no unpaid balance")
        # Lock the invoice row across reminder claims; PostgreSQL provides cross-worker exclusion.
        db.scalar(select(Invoice).where(Invoice.id == invoice.id).with_for_update())
        recent = db.scalar(
            select(Operation.id).where(
                Operation.resource_id == invoice.id,
                Operation.kind == "reminder",
                Operation.id != operation.id,
                Operation.status.in_(["executing", "succeeded", "unknown"]),
                Operation.started_at > now() - timedelta(hours=settings.reminder_cooldown_hours),
            )
        )
        if recent:
            raise HTTPException(409, "Reminder cooldown is active")
    claimed = db.execute(
        update(Operation)
        .where(Operation.id == operation_id, Operation.status == "proposed")
        .values(status="executing", started_at=now())
    ).rowcount
    db.commit()
    if not claimed:
        raise HTTPException(409, "Operation has already been claimed")
    try:
        resource = segment(operation.resource_id)
        if operation.kind == "reminder":
            result = await paypal.request(
                "POST",
                f"/v2/invoicing/invoices/{resource}/remind",
                payload={**operation.payload, "send_to_recipient": True},
                request_id=operation.id,
            )
        elif operation.kind == "create_invoice":
            result = await paypal.request(
                "POST", "/v2/invoicing/invoices", payload=operation.payload, request_id=operation.id
            )
            upsert_invoice(db, result)
        elif operation.kind == "send_invoice":
            result = await paypal.request(
                "POST",
                f"/v2/invoicing/invoices/{resource}/send",
                payload={"send_to_recipient": True},
                request_id=operation.id,
            )
        elif operation.kind == "subscription":
            result = await paypal.request(
                "POST",
                f"/v1/billing/subscriptions/{resource}/{operation.payload['action']}",
                payload={"reason": operation.payload["reason"]},
                request_id=operation.id,
            )
        else:
            raise ValueError("Unsupported operation")
    except Exception:
        # The provider may have committed a write before the connection failed.
        operation.status = "unknown"
        db.add(Audit(action="operation.unknown", resource_id=operation.id, actor=actor))
        db.commit()
        raise
    operation.status, operation.result = "succeeded", result
    db.add(Audit(action="operation.succeeded", resource_id=operation.id, actor=actor))
    db.commit()
    return serialize(operation)


async def sync_paypal(db, paypal, settings, start, end):
    for page in range(1, 101):
        data = await paypal.request(
            "GET",
            "/v2/invoicing/invoices",
            params={"page": page, "page_size": 100, "total_required": "true"},
        )
        for item in data.get("items", []):
            canonical = await paypal.request("GET", f"/v2/invoicing/invoices/{segment(item['id'])}")
            upsert_invoice(db, canonical)
        db.commit()
        if not data.get("items") or page * 100 >= data.get("total_items", 0):
            break
    else:
        raise ValueError("Invoice page budget exceeded")
    for page in range(1, 101):
        data = await paypal.request(
            "GET",
            "/v1/reporting/transactions",
            params={
                "start_date": start + "T00:00:00Z",
                "end_date": end + "T23:59:59Z",
                "fields": "all",
                "page_size": 100,
                "page": page,
            },
        )
        for item in data.get("transaction_details", []):
            upsert_transaction(db, item, settings)
        db.commit()
        if page >= data.get("total_pages", 1):
            break
    else:
        raise ValueError("Transaction page budget exceeded")


def scan_overdue(db, automatic):
    for invoice in db.scalars(overdue_query()):
        event_id = f"overdue:{invoice.id}:{now().date().isoformat()}"
        emit(db, "invoice.overdue", invoice.id, event_id)
        if automatic:
            days = (now().date() - date.fromisoformat(invoice.due_date)).days
            note = f"A friendly reminder that invoice {invoice.id} has an outstanding balance of {invoice.outstanding} {invoice.currency}. Please let us know if you need assistance."
            if days >= 14:
                note = f"Following up on invoice {invoice.id}, now {days} days overdue. Please arrange payment of {invoice.outstanding} {invoice.currency} or contact us to discuss a payment plan."
            enqueue(db, "reminder", {"invoice_id": invoice.id, "note": note}, event_id)
    db.commit()
