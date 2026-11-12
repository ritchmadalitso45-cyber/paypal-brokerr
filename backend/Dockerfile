FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml requirements.lock ./
COPY copilot ./copilot
RUN pip install --no-cache-dir -r requirements.lock && pip install --no-deps . && useradd --create-home copilot
COPY alembic.ini ./
COPY migrations ./migrations
USER copilot
EXPOSE 8000
CMD ["uvicorn", "copilot.api:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
