.PHONY: run worker test lint migrate
run:
	uvicorn copilot.api:app --host 127.0.0.1 --port 8000
worker:
	python -m copilot.worker
test:
	python -m pytest -q
lint:
	python -m ruff check .
migrate:
	alembic upgrade head
