import os
from functools import lru_cache
from urllib.parse import urlparse

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite:///./copilot.db"
    admin_api_key: SecretStr = SecretStr("")
    viewer_api_key: SecretStr = SecretStr("")
    paypal_environment: str = "sandbox"
    paypal_client_id: SecretStr = SecretStr("")
    paypal_client_secret: SecretStr = SecretStr("")
    paypal_webhook_id: str = ""
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = ""
    elastic_url: str = ""
    elastic_api_key: SecretStr = SecretStr("")
    redis_url: str = ""
    zapier_webhook_url: SecretStr = SecretStr("")
    slack_webhook_url: SecretStr = SecretStr("")
    crm_webhook_url: SecretStr = SecretStr("")
    automatic_reminders: bool = False
    reminder_cooldown_hours: int = 24
    allowed_countries: str = "ZA,GB,US"
    high_value_threshold: int = 10000
    cors_origins: str = ""
    firebase_project_id: str = ""
    firebase_merchant_id: str = ""
    firebase_credentials_file: str = ""

    @model_validator(mode="after")
    def validate_deployment(self):
        if self.environment not in {"development", "test", "production"}:
            raise ValueError("Invalid environment")
        if self.paypal_environment not in {"sandbox", "live"}:
            raise ValueError("PayPal environment must be sandbox or live")
        if self.reminder_cooldown_hours < 24:
            raise ValueError("Reminder cooldown must be at least 24 hours")
        for field in ("zapier_webhook_url", "slack_webhook_url", "crm_webhook_url"):
            value = getattr(self, field).get_secret_value()
            if value and urlparse(value).scheme != "https":
                raise ValueError(f"{field} must use HTTPS")
        if (
            self.elastic_url
            and urlparse(self.elastic_url).scheme != "https"
            and self.environment == "production"
        ):
            raise ValueError("Production Elastic requires HTTPS")
        if self.environment == "production":
            if os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"):
                raise ValueError("Firebase emulator is forbidden in production")
            if (
                not self.database_url.startswith(("postgresql", "postgres://"))
                or not self.redis_url
            ):
                raise ValueError("Production requires PostgreSQL and Redis")
            if len(self.admin_api_key.get_secret_value()) < 32:
                raise ValueError("Production admin key must contain at least 32 characters")
            if (
                self.viewer_api_key.get_secret_value()
                and len(self.viewer_api_key.get_secret_value()) < 32
            ):
                raise ValueError("Production viewer key must contain at least 32 characters")
        if self.admin_api_key.get_secret_value() and self.admin_api_key == self.viewer_api_key:
            raise ValueError("Admin and viewer keys must differ")
        if bool(self.firebase_project_id) != bool(self.firebase_merchant_id):
            raise ValueError("Configure both Firebase project and merchant IDs")
        return self


@lru_cache
def get_settings():
    return Settings()
