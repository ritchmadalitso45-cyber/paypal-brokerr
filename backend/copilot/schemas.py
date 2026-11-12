from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ResourceId = Annotated[str, Field(pattern=r"^[A-Za-z0-9-]{1,128}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LineItem(StrictModel):
    name: str = Field(min_length=1, max_length=127)
    quantity: int = Field(ge=1, le=10000)
    unit_amount: Decimal = Field(gt=0, le=1000000, decimal_places=2)


class CreateInvoice(StrictModel):
    customer_email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    due_date: date
    items: list[LineItem] = Field(min_length=1, max_length=100)

    @field_validator("currency")
    @classmethod
    def supported_currency(cls, value):
        # Restrict creation to currencies with two decimal places.
        if value not in {"USD", "GBP", "EUR", "CAD", "AUD", "CHF", "NZD", "HKD", "SGD"}:
            raise ValueError("Unsupported invoice currency")
        return value


class Reminder(StrictModel):
    subject: str = Field(default="A friendly payment reminder", min_length=1, max_length=100)
    note: str = Field(min_length=1, max_length=1000)


class SyncRequest(StrictModel):
    start: date
    end: date


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=2000)


class WorkflowRequest(StrictModel):
    event: Literal["invoice.overdue", "payment.succeeded", "payment.failed", "alert.created"]
    destination: Literal["zapier", "slack", "crm"]


class SubscriptionAction(StrictModel):
    action: Literal["suspend", "activate", "cancel"]
    reason: str = Field(min_length=1, max_length=128)


class Reconciliation(StrictModel):
    outcome: Literal["confirmed_succeeded", "confirmed_not_applied"]
    evidence: str = Field(min_length=20, max_length=1000)
