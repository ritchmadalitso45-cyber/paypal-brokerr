from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from copilot.config import Settings
from copilot.firebase_identity import FirebaseIdentity


def identity():
    verifier = FirebaseIdentity(
        Settings(_env_file=None, firebase_project_id="project-1", firebase_merchant_id="merchant-1")
    )
    verifier.app = object()
    return verifier


async def test_signed_claims_define_role_and_merchant():
    claims = {
        "uid": "user-1",
        "email_verified": True,
        "broker_role": "viewer",
        "broker_merchant_id": "merchant-1",
    }
    with patch("copilot.firebase_identity.auth.verify_id_token", return_value=claims) as verify:
        result = await identity().verify("signed-token")
        assert result["role"] == "viewer"
        assert verify.call_args.kwargs["check_revoked"] is True


@pytest.mark.parametrize(
    "claims",
    [
        {"uid": "user-1", "role": "admin", "email_verified": True},
        {
            "uid": "user-1",
            "broker_role": "admin",
            "broker_merchant_id": "other",
            "email_verified": True,
        },
        {
            "uid": "user-1",
            "broker_role": "admin",
            "broker_merchant_id": "merchant-1",
            "email_verified": False,
        },
    ],
)
async def test_unassigned_wrong_merchant_and_unverified_users_are_denied(claims):
    with patch("copilot.firebase_identity.auth.verify_id_token", return_value=claims):
        with pytest.raises(HTTPException) as failure:
            await identity().verify("signed-token")
        assert failure.value.status_code == 403


async def test_invalid_signature_is_unauthorized():
    with patch(
        "copilot.firebase_identity.auth.verify_id_token", side_effect=ValueError("invalid token")
    ):
        with pytest.raises(HTTPException) as failure:
            await identity().verify("forged-token")
        assert failure.value.status_code == 401


def test_firebase_viewer_cannot_mutate_and_session_comes_from_verified_identity(client):
    settings = client.app.state.settings
    settings.firebase_project_id, settings.firebase_merchant_id = "project-1", "merchant-1"
    client.app.state.identity.verify = AsyncMock(
        return_value={
            "uid": "user-1",
            "role": "viewer",
            "merchant_id": "merchant-1",
            "email": "user@example.com",
        }
    )
    headers = {"Authorization": "Bearer signed-token"}
    assert client.get("/api/v1/session", headers=headers).json()["uid"] == "user-1"
    assert client.get("/api/v1/dashboard", headers=headers).status_code == 200
    assert (
        client.post(
            "/api/v1/invoices/INV-1/reminders", headers=headers, json={"note": "Please pay"}
        ).status_code
        == 403
    )
    assert client.get("/api/v1/operations", headers=headers).status_code == 403
