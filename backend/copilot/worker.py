"""Durable outbox worker. PostgreSQL SKIP LOCKED supports multiple worker processes."""

import asyncio
import logging
from contextlib import suppress
from datetime import timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy import select, update

from copilot.config import get_settings
from copilot.database import Job, Operation, make_database, now
from copilot.providers import Connectors, PayPal
from copilot.services import enqueue, execute_operation, propose, scan_overdue, sync_paypal

logger = logging.getLogger("copilot.worker")


def claim_job(factory):
    with factory() as db:
        # Reclaim abandoned reads/deliveries. Reminder jobs are safe because their operation
        # cannot transition out of executing/unknown without manual reconciliation.
        db.execute(
            update(Job)
            .where(Job.status == "running", Job.locked_at < now() - timedelta(minutes=15))
            .values(status="pending")
        )
        job = db.scalar(
            select(Job)
            .where(Job.status == "pending", Job.available_at <= now())
            .order_by(Job.available_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if not job:
            db.commit()
            return None
        job.status, job.locked_at = "running", now()
        job.attempts += 1
        db.commit()
        return job.id


async def process_job(db, job, paypal, connectors, settings):
    payload = job.payload
    if job.kind == "sync":
        await sync_paypal(db, paypal, settings, payload["start"], payload["end"])
    elif job.kind == "index":
        await connectors.index_transaction(payload)
    elif job.kind == "deliver":
        # At least once delivery; receivers should deduplicate using event_id.
        await connectors.deliver(payload["destination"], payload)
    elif job.kind == "reminder":
        operation = db.scalar(select(Operation).where(Operation.key == "automatic:" + job.id))
        if not operation:
            operation = propose(
                db,
                "automatic:" + job.id,
                "reminder",
                payload["invoice_id"],
                {"subject": "Payment reminder", "note": payload["note"]},
                actor="worker",
            )
        try:
            await execute_operation(db, operation.id, paypal, settings, actor="worker")
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
    else:
        raise ValueError("Unknown job type")


async def heartbeat(factory, job_id):
    while True:
        await asyncio.sleep(30)
        with factory() as db:
            db.execute(
                update(Job).where(Job.id == job_id, Job.status == "running").values(locked_at=now())
            )
            db.commit()


async def run():
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()
    engine, factory = make_database(settings.database_url)
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        paypal, connectors = PayPal(settings, client), Connectors(settings, client)
        last_scan = None
        while True:
            if last_scan is None or now() - last_scan > timedelta(minutes=10):
                with factory() as db:
                    scan_overdue(db, settings.automatic_reminders)
                    # A rolling 48-hour window tolerates delayed PayPal reporting.
                    enqueue(
                        db,
                        "sync",
                        {
                            "start": (now().date() - timedelta(days=2)).isoformat(),
                            "end": now().date().isoformat(),
                        },
                        "scheduled:" + now().strftime("%Y%m%d%H%M")[:11],
                    )
                    db.commit()
                last_scan = now()
            job_id = claim_job(factory)
            if not job_id:
                await asyncio.sleep(2)
                continue
            with factory() as db:
                job = db.get(Job, job_id)
                pulse = asyncio.create_task(heartbeat(factory, job_id))
                try:
                    await process_job(db, job, paypal, connectors, settings)
                    job.status, job.error = "succeeded", None
                except Exception as exc:
                    db.rollback()
                    job = db.get(Job, job_id)
                    job.error = type(exc).__name__
                    job.status = "dead" if job.attempts >= 5 else "pending"
                    job.available_at = now() + timedelta(seconds=min(3600, 30 * 2**job.attempts))
                    logger.warning("Job %s failed (%s)", job_id, job.error)
                finally:
                    pulse.cancel()
                    with suppress(asyncio.CancelledError):
                        await pulse
                db.commit()
    engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
