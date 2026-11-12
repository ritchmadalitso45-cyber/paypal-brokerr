"""Only signed server-managed claims authorize access to this merchant deployment."""

import asyncio

import firebase_admin
from fastapi import HTTPException
from firebase_admin import auth, credentials
from firebase_admin.exceptions import FirebaseError
from google.auth.exceptions import DefaultCredentialsError, TransportError


class FirebaseIdentity:
    def __init__(self, settings):
        self.settings = settings
        self.app = None

    def initialize(self):
        if not self.settings.firebase_project_id:
            return
        credential = (
            credentials.Certificate(self.settings.firebase_credentials_file)
            if self.settings.firebase_credentials_file
            else credentials.ApplicationDefault()
        )
        self.app = firebase_admin.initialize_app(
            credential,
            {"projectId": self.settings.firebase_project_id},
            name="broker-" + __import__("uuid").uuid4().hex,
        )

    def close(self):
        if self.app:
            firebase_admin.delete_app(self.app)

    async def verify(self, token):
        if not self.app:
            raise HTTPException(401, "A valid bearer credential is required")
        try:
            claims = await asyncio.to_thread(
                auth.verify_id_token, token, app=self.app, check_revoked=True
            )
        except (
            auth.InvalidIdTokenError,
            auth.ExpiredIdTokenError,
            auth.RevokedIdTokenError,
            auth.UserDisabledError,
            ValueError,
        ):
            raise HTTPException(401, "Firebase session expired or invalid; sign in again") from None
        except (FirebaseError, DefaultCredentialsError, TransportError):
            raise HTTPException(503, "Identity verification temporarily unavailable") from None
        # Neither Firestore profile fields nor client-selected roles authorize access.
        role = claims.get("broker_role")
        if claims.get("broker_merchant_id") != self.settings.firebase_merchant_id or role not in {
            "admin",
            "viewer",
        }:
            raise HTTPException(403, "Your account has not been granted access to this merchant")
        if not claims.get("email_verified"):
            raise HTTPException(403, "Verify your email before accessing payment data")
        return {
            "uid": claims["uid"],
            "email": claims.get("email", ""),
            "role": role,
            "merchant_id": self.settings.firebase_merchant_id,
        }
