"""Trusted operator CLI. Never expose claim assignment to the browser."""

import argparse

import firebase_admin
from firebase_admin import auth, credentials

from copilot.config import get_settings


def main():
    parser = argparse.ArgumentParser(description="Assign PayPal Broker merchant membership")
    parser.add_argument("uid")
    parser.add_argument("role", choices=["admin", "viewer", "revoke"])
    args = parser.parse_args()
    settings = get_settings()
    if not settings.firebase_project_id or not settings.firebase_merchant_id:
        parser.error("Configure Firebase project and merchant IDs first")
    credential = (
        credentials.Certificate(settings.firebase_credentials_file)
        if settings.firebase_credentials_file
        else credentials.ApplicationDefault()
    )
    app = firebase_admin.initialize_app(credential, {"projectId": settings.firebase_project_id})
    user = auth.get_user(args.uid, app=app)
    claims = dict(user.custom_claims or {})
    if args.role == "revoke":
        claims.pop("broker_role", None)
        claims.pop("broker_merchant_id", None)
    else:
        claims.update(broker_role=args.role, broker_merchant_id=settings.firebase_merchant_id)
    auth.set_custom_user_claims(args.uid, claims, app=app)
    # Invalidate earlier permissions, including tokens held by a demoted user.
    auth.revoke_refresh_tokens(args.uid, app=app)
    print("Access updated. The user must sign in again and verify their email.")
    firebase_admin.delete_app(app)


if __name__ == "__main__":
    main()
