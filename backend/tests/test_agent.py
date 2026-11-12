import json
from unittest.mock import AsyncMock

import httpx
from test_api import seed


def test_assistant_proposes_but_does_not_execute(client, admin):
    seed(client)
    client.app.state.settings.openai_api_key = __import__("pydantic").SecretStr("key")
    client.app.state.settings.openai_model = "configured-test-model"
    client.app.state.paypal.request = AsyncMock()
    client.app.state.client.post = AsyncMock(
        side_effect=[
            httpx.Response(
                200,
                json={
                    "output": [
                        {
                            "type": "function_call",
                            "name": "propose_reminder",
                            "arguments": json.dumps(
                                {"invoice_id": "INV-1", "note": "Please arrange payment."}
                            ),
                            "call_id": "call-1",
                        }
                    ]
                },
            ),
            httpx.Response(
                200,
                json={
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": "Your reminder is drafted and requires approval.",
                                }
                            ],
                        }
                    ]
                },
            ),
        ]
    )
    response = client.post(
        "/api/v1/agent/chat", headers=admin, json={"message": "Remind the overdue client"}
    )
    assert response.status_code == 200
    assert response.json()["actions_require_approval"]
    client.app.state.paypal.request.assert_not_called()


def test_viewer_cannot_invoke_proposal_tool_even_if_model_requests_it(client, viewer):
    from sqlalchemy import func, select

    from copilot.database import Operation

    seed(client)
    client.app.state.settings.openai_api_key = __import__("pydantic").SecretStr("key")
    client.app.state.settings.openai_model = "configured-test-model"
    client.app.state.client.post = AsyncMock(
        side_effect=[
            httpx.Response(
                200,
                json={
                    "output": [
                        {
                            "type": "function_call",
                            "name": "propose_reminder",
                            "arguments": json.dumps({"invoice_id": "INV-1", "note": "Pay now"}),
                            "call_id": "call-1",
                        }
                    ]
                },
            ),
            httpx.Response(
                200,
                json={
                    "output": [
                        {
                            "type": "message",
                            "content": [
                                {"type": "output_text", "text": "Administrator access is required."}
                            ],
                        }
                    ]
                },
            ),
        ]
    )
    assert (
        client.post(
            "/api/v1/agent/chat", headers=viewer, json={"message": "Send reminder"}
        ).status_code
        == 200
    )
    with client.app.state.factory() as db:
        assert db.scalar(select(func.count()).select_from(Operation)) == 0
