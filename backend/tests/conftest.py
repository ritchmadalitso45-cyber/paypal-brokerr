import pytest
from fastapi.testclient import TestClient

from copilot.api import create_app
from copilot.config import Settings
from copilot.database import Base


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        _env_file=None,
        environment="test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        admin_api_key="test-admin-key",
        viewer_api_key="test-viewer-key",
    )
    with TestClient(create_app(settings)) as client:
        Base.metadata.create_all(client.app.state.engine)
        yield client


@pytest.fixture
def admin():
    return {"Authorization": "Bearer test-admin-key"}


@pytest.fixture
def viewer():
    return {"Authorization": "Bearer test-viewer-key"}
