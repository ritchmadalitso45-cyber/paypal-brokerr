import asyncio
import json
import logging
import re
from contextlib import asynccontextmanager
from datetime import timedelta
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from copilot.agent import chat
from copilot.config import get_settings
from copilot.database import (
    Alert,
    Audit,
    Invoice,
    Job,
    Operation,
    Transaction,
    WebhookEvent,
    Workflow,
    make_database,
    now,
)
from copilot.firebase_identity import FirebaseIdentity
from copilot.providers import Connectors, PayPal, ProviderError, segment
from copilot.schemas import (
    ChatRequest,
    CreateInvoice,
    Reconciliation,
    Reminder,
    ResourceId,
    SubscriptionAction,
    SyncRequest,
    WorkflowRequest,
)
from copilot.security import RateLimiter, administrator, principal
from copilot.services import (
    dashboard,
    emit,
    enqueue,
    execute_operation,
    overdue_query,
    propose,
    scan_overdue,
    serialize,
)


def database(request: Request):
    with request.app.state.factory() as session:
        yield session


def idempotency_key(value: str = Header(alias="Idempotency-Key")):
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,128}", value):
        raise HTTPException(
            422, "Idempotency-Key must be 8–128 letters, digits, underscores or hyphens"
        )
    return value


def create_app(settings=None):
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        engine, factory = make_database(settings.database_url)
        app.state.engine, app.state.factory = engine, factory
        redis = Redis.from_url(settings.redis_url) if settings.redis_url else None
        app.state.limiter = RateLimiter(redis)
        app.state.identity = FirebaseIdentity(settings)
        app.state.identity.initialize()
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30, connect=5), follow_redirects=False
        ) as client:
            app.state.client = client
            app.state.paypal = PayPal(settings, client)
            app.state.connectors = Connectors(settings, client)
            yield
        app.state.identity.close()
        if redis:
            await redis.aclose()
        engine.dispose()

    app = FastAPI(
        title="PayPal Broker API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = settings
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[x.strip() for x in settings.cors_origins.split(",")],
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
            expose_headers=["X-Request-Id"],
        )

    @app.middleware("http")
    async def boundaries(request, call_next):
        request_id = str(uuid4())
        # Enforce the limit while reading, including requests without Content-Length.
        if request.method in {"POST", "PUT", "PATCH"}:
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 262144:
                    return JSONResponse({"detail": "Request exceeds 256 KiB"}, status_code=413)
            request._body = bytes(body)
        try:
            response = await call_next(request)
        except Exception as exc:
            logging.getLogger("copilot.api").error(
                "Request %s failed (%s)", request_id, type(exc).__name__
            )
            response = JSONResponse(
                {"detail": "Internal error", "request_id": request_id}, status_code=500
            )
        response.headers.update(
            {
                "X-Request-Id": request_id,
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
            }
        )
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    @app.exception_handler(ProviderError)
    async def provider_failure(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=exc.status)

    @app.exception_handler(httpx.HTTPError)
    async def transport_failure(request, exc):
        return JSONResponse({"detail": "Integration temporarily unavailable"}, status_code=502)

    @app.get("/health/live")
    def live():
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready(request: Request, db=Depends(database)):
        try:
            db.execute(text("SELECT 1"))
            db.execute(select(Invoice.id).limit(1))
            if request.app.state.limiter.redis:
                await request.app.state.limiter.redis.ping()
        except Exception:
            raise HTTPException(503, "Dependencies are not ready") from None
        return {"status": "ready"}

    @app.get("/api/v1/openapi.json", dependencies=[Depends(principal)])
    def openapi():
        return app.openapi()

    @app.get("/api/v1/integrations", dependencies=[Depends(principal)])
    def integrations():
        return {
            "paypal": {
                "configured": bool(
                    settings.paypal_client_id.get_secret_value()
                    and settings.paypal_client_secret.get_secret_value()
                ),
                "environment": settings.paypal_environment,
                "webhook_configured": bool(settings.paypal_webhook_id),
            },
            "openai": bool(settings.openai_api_key.get_secret_value() and settings.openai_model),
            "elastic": bool(settings.elastic_url),
            "zapier": bool(settings.zapier_webhook_url.get_secret_value()),
            "slack": bool(settings.slack_webhook_url.get_secret_value()),
            "crm": bool(settings.crm_webhook_url.get_secret_value()),
            "automatic_reminders": settings.automatic_reminders,
        }

    @app.get("/api/v1/dashboard", dependencies=[Depends(principal)])
    def summary(db=Depends(database)):
        return dashboard(db)

    @app.get("/api/v1/session", dependencies=[Depends(principal)])
    def session(request: Request):
        return request.state.identity

    @app.get("/api/v1/operations", dependencies=[Depends(administrator)])
    def operations(
        status: str | None = None,
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0, le=100000),
        db=Depends(database),
    ):
        query = select(Operation)
        if status:
            query = query.where(Operation.status == status)
        return {
            "items": [
                serialize(row)
                for row in db.scalars(
                    query.order_by(Operation.created_at.desc()).offset(offset).limit(limit)
                )
            ]
        }

    @app.get("/api/v1/invoices", dependencies=[Depends(principal)])
    def invoices(
        status: str | None = None,
        overdue: bool = False,
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0, le=100000),
        db=Depends(database),
    ):
        query = overdue_query() if overdue else select(Invoice)
        if status:
            query = query.where(Invoice.status == status)
        return {
            "items": [
                serialize(row)
                for row in db.scalars(query.order_by(Invoice.id).offset(offset).limit(limit))
            ],
            "offset": offset,
            "limit": limit,
        }

    @app.get("/api/v1/invoices/{invoice_id}", dependencies=[Depends(principal)])
    def invoice(invoice_id: ResourceId, db=Depends(database)):
        row = db.get(Invoice, invoice_id)
        if not row:
            raise HTTPException(404, "Invoice not found")
        return serialize(row)

    @app.post("/api/v1/invoices", status_code=201, dependencies=[Depends(administrator)])
    def create_invoice(body: CreateInvoice, key=Depends(idempotency_key), db=Depends(database)):
        payload = {
            "detail": {
                "currency_code": body.currency,
                "payment_term": {
                    "term_type": "DUE_ON_DATE_SPECIFIED",
                    "due_date": body.due_date.isoformat(),
                },
            },
            "primary_recipients": [{"billing_info": {"email_address": body.customer_email}}],
            "items": [
                {
                    "name": item.name,
                    "quantity": str(item.quantity),
                    "unit_amount": {
                        "currency_code": body.currency,
                        "value": f"{item.unit_amount:.2f}",
                    },
                }
                for item in body.items
            ],
        }
        return serialize(propose(db, key, "create_invoice", "new", payload))

    @app.post(
        "/api/v1/invoices/{invoice_id}/send", status_code=201, dependencies=[Depends(administrator)]
    )
    def send_invoice(invoice_id: ResourceId, key=Depends(idempotency_key), db=Depends(database)):
        return serialize(propose(db, key, "send_invoice", invoice_id, {}))

    @app.post(
        "/api/v1/invoices/{invoice_id}/reminders",
        status_code=201,
        dependencies=[Depends(administrator)],
    )
    def reminder(
        invoice_id: ResourceId, body: Reminder, key=Depends(idempotency_key), db=Depends(database)
    ):
        return serialize(propose(db, key, "reminder", invoice_id, body.model_dump()))

    @app.get("/api/v1/operations/{operation_id}", dependencies=[Depends(administrator)])
    def operation(operation_id: ResourceId, db=Depends(database)):
        row = db.get(Operation, operation_id)
        if not row:
            raise HTTPException(404, "Operation not found")
        return serialize(row)

    @app.post("/api/v1/operations/{operation_id}/approve", dependencies=[Depends(administrator)])
    async def approve(operation_id: ResourceId, request: Request, db=Depends(database)):
        return await execute_operation(db, operation_id, request.app.state.paypal, settings)

    @app.post("/api/v1/operations/{operation_id}/reconcile", dependencies=[Depends(administrator)])
    def reconcile(operation_id: ResourceId, body: Reconciliation, db=Depends(database)):
        row = db.scalar(select(Operation).where(Operation.id == operation_id).with_for_update())
        if not row:
            raise HTTPException(404, "Operation not found")
        if row.status not in {"unknown", "executing"}:
            raise HTTPException(409, "Only uncertain operations can be reconciled")
        if row.created_at > now() - timedelta(minutes=20):
            raise HTTPException(409, "Wait at least 20 minutes before reconciliation")
        row.status = "succeeded" if body.outcome == "confirmed_succeeded" else "not_applied"
        row.result = {"reconciled": True, "outcome": body.outcome}
        db.add(
            Audit(
                action="operation.reconciled",
                resource_id=row.id,
                actor="admin",
                detail=body.evidence,
            )
        )
        db.commit()
        return serialize(row)

    @app.get("/api/v1/transactions", dependencies=[Depends(principal)])
    def transactions(
        currency: str | None = None,
        status: str | None = None,
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0, le=100000),
        db=Depends(database),
    ):
        query = select(Transaction)
        if currency:
            query = query.where(Transaction.currency == currency)
        if status:
            query = query.where(Transaction.status == status)
        return {
            "items": [
                serialize(row)
                for row in db.scalars(
                    query.order_by(Transaction.occurred_at.desc(), Transaction.id)
                    .offset(offset)
                    .limit(limit)
                )
            ],
            "offset": offset,
            "limit": limit,
        }

    @app.get("/api/v1/transactions/search", dependencies=[Depends(principal)])
    async def search(
        request: Request,
        q: str = Query(min_length=1, max_length=200),
        offset: int = Query(0, ge=0, le=9800),
        limit: int = Query(50, ge=1, le=200),
    ):
        return await request.app.state.connectors.search_transactions(q, offset, limit)

    @app.get("/api/v1/transactions/{transaction_id}", dependencies=[Depends(principal)])
    def transaction(transaction_id: ResourceId, db=Depends(database)):
        row = db.get(Transaction, transaction_id)
        if not row:
            raise HTTPException(404, "Transaction not found")
        return serialize(row)

    @app.get("/api/v1/alerts", dependencies=[Depends(principal)])
    def alerts(
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0, le=100000),
        db=Depends(database),
    ):
        return {
            "items": [
                serialize(row)
                for row in db.scalars(
                    select(Alert)
                    .order_by(Alert.created_at.desc(), Alert.id)
                    .offset(offset)
                    .limit(limit)
                )
            ]
        }

    @app.get("/api/v1/subscriptions/{subscription_id}", dependencies=[Depends(principal)])
    async def subscription(subscription_id: ResourceId, request: Request):
        return await request.app.state.paypal.request(
            "GET", "/v1/billing/subscriptions/" + segment(subscription_id)
        )

    @app.post(
        "/api/v1/subscriptions/{subscription_id}/actions",
        status_code=201,
        dependencies=[Depends(administrator)],
    )
    def subscription_action(
        subscription_id: ResourceId,
        body: SubscriptionAction,
        key=Depends(idempotency_key),
        db=Depends(database),
    ):
        return serialize(propose(db, key, "subscription", subscription_id, body.model_dump()))

    @app.get("/api/v1/disputes", dependencies=[Depends(principal)])
    async def disputes(request: Request, page_size: int = Query(20, ge=1, le=50)):
        return await request.app.state.paypal.request(
            "GET", "/v1/customer/disputes", params={"page_size": page_size}
        )

    @app.post("/api/v1/sync", status_code=202, dependencies=[Depends(administrator)])
    def sync(body: SyncRequest, key=Depends(idempotency_key), db=Depends(database)):
        if body.start > body.end or (body.end - body.start).days > 30 or body.end > now().date():
            raise HTTPException(422, "Select a past date range of at most 31 calendar days")
        payload = body.model_dump(mode="json")
        job = enqueue(db, "sync", payload, "sync:" + key)
        if job.payload != payload:
            raise HTTPException(409, "Idempotency key conflict")
        db.commit()
        return {"job_id": job.id, "status": job.status}

    @app.post("/api/v1/overdue/scan", status_code=202, dependencies=[Depends(administrator)])
    def overdue_scan(db=Depends(database)):
        scan_overdue(db, settings.automatic_reminders)
        return {"queued": True, "automatic_reminders": settings.automatic_reminders}

    @app.get("/api/v1/jobs/{job_id}", dependencies=[Depends(administrator)])
    def job_status(job_id: ResourceId, db=Depends(database)):
        row = db.get(Job, job_id)
        if not row:
            raise HTTPException(404, "Job not found")
        return {
            "id": row.id,
            "kind": row.kind,
            "status": row.status,
            "attempts": row.attempts,
            "error": row.error,
        }

    @app.post("/api/v1/workflows", status_code=201, dependencies=[Depends(administrator)])
    def workflow(body: WorkflowRequest, db=Depends(database)):
        if not getattr(settings, f"{body.destination}_webhook_url").get_secret_value():
            raise HTTPException(409, "Configure this destination before creating a workflow")
        row = Workflow(**body.model_dump())
        db.add(row)
        db.add(
            Audit(
                action="workflow.created",
                resource_id=row.id or "new",
                actor="admin",
                detail=body.event,
            )
        )
        db.commit()
        return serialize(row)

    @app.get("/api/v1/workflows", dependencies=[Depends(administrator)])
    def workflows(db=Depends(database)):
        return {"items": [serialize(row) for row in db.scalars(select(Workflow))]}

    @app.delete(
        "/api/v1/workflows/{workflow_id}", status_code=204, dependencies=[Depends(administrator)]
    )
    def delete_workflow(workflow_id: ResourceId, db=Depends(database)):
        row = db.get(Workflow, workflow_id)
        if not row:
            raise HTTPException(404, "Workflow not found")
        row.enabled = False
        db.add(Audit(action="workflow.disabled", resource_id=row.id, actor="admin"))
        db.commit()

    @app.get("/api/v1/audit", dependencies=[Depends(administrator)])
    def audit(
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0, le=100000),
        db=Depends(database),
    ):
        return {
            "items": [
                serialize(row)
                for row in db.scalars(
                    select(Audit)
                    .order_by(Audit.created_at.desc(), Audit.id)
                    .offset(offset)
                    .limit(limit)
                )
            ]
        }

    @app.post("/api/v1/agent/chat")
    async def agent_chat(
        body: ChatRequest, request: Request, role=Depends(principal), db=Depends(database)
    ):
        await request.app.state.limiter.check(role + ":chat", limit=20)
        return await chat(db, body.message, settings, request.app.state.client, role)

    @app.get("/api/v1/events", dependencies=[Depends(principal)])
    async def events(request: Request):
        async def stream():
            # Short sessions bound connections. Clients reconnect with bearer headers.
            for _ in range(20):
                if await request.is_disconnected():
                    return
                with request.app.state.factory() as db:
                    data = json.dumps(jsonable_encoder(dashboard(db)))
                yield f"event: dashboard\ndata: {data}\n\n"
                await asyncio.sleep(3)

        return StreamingResponse(
            stream(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"}
        )

    @app.post("/api/v1/webhooks/paypal", status_code=202)
    async def webhook(request: Request, db=Depends(database)):
        await request.app.state.limiter.check("webhook", limit=1000)
        try:
            event = await request.json()
        except (ValueError, UnicodeError):
            raise HTTPException(400, "Invalid JSON") from None
        if (
            not isinstance(event, dict)
            or not isinstance(event.get("id"), str)
            or not isinstance(event.get("event_type"), str)
            or len(event["id"]) > 128
            or len(event["event_type"]) > 100
        ):
            raise HTTPException(422, "Missing or invalid event identity")
        if not await request.app.state.paypal.verify_webhook(request.headers, event):
            raise HTTPException(401, "Webhook signature verification failed")
        if db.get(WebhookEvent, event["id"]):
            return {"accepted": True, "duplicate": True}
        try:
            db.add(WebhookEvent(id=event["id"], event_type=event["event_type"]))
            db.flush()
            enqueue(
                db,
                "sync",
                {
                    "start": (now().date() - timedelta(days=2)).isoformat(),
                    "end": now().date().isoformat(),
                },
                "webhook:" + event["id"],
            )
            mapping = {
                "PAYMENT.CAPTURE.COMPLETED": "payment.succeeded",
                "PAYMENT.SALE.COMPLETED": "payment.succeeded",
                "PAYMENT.CAPTURE.DENIED": "payment.failed",
                "PAYMENT.SALE.DENIED": "payment.failed",
            }
            if event["event_type"] in mapping:
                resource = event.get("resource", {}).get("id", event["id"])
                emit(db, mapping[event["event_type"]], resource, event["id"])
            db.commit()
        except IntegrityError:
            db.rollback()
            if not db.get(WebhookEvent, event["id"]):
                raise
        return {"accepted": True}

    return app


app = create_app()
