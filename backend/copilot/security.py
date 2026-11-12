import hashlib
import secrets
import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer

bearer = HTTPBearer(auto_error=False)


class RateLimiter:
    def __init__(self, redis=None):
        self.redis = redis
        self.local = defaultdict(lambda: [0, 0])

    async def check(self, identity, limit=120):
        digest = hashlib.sha256(identity.encode()).hexdigest()
        bucket = int(time.time()) // 60
        if self.redis:
            # INCR and expiry are atomic, including under process crashes.
            count = await self.redis.eval(
                "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 65) end; return n",
                1,
                f"rate:{digest}:{bucket}",
            )
        else:
            if len(self.local) > 10000:
                self.local.clear()
            current = self.local[digest]
            if current[0] != bucket:
                current[:] = [bucket, 0]
            current[1] += 1
            count = current[1]
        if count > limit:
            raise HTTPException(429, "Rate limit exceeded", headers={"Retry-After": "60"})


async def principal(request: Request, credentials=Depends(bearer)):
    authorization = request.headers.get("authorization", "")
    token = authorization[7:] if authorization.startswith("Bearer ") else ""
    settings = request.app.state.settings
    role = None
    for name, expected in (("admin", settings.admin_api_key), ("viewer", settings.viewer_api_key)):
        if expected.get_secret_value() and secrets.compare_digest(
            token, expected.get_secret_value()
        ):
            role = name
    if not role:
        if not token or not settings.firebase_project_id:
            raise HTTPException(
                401, "A valid bearer credential is required", headers={"WWW-Authenticate": "Bearer"}
            )
        identity = await request.app.state.identity.verify(token)
        request.state.identity = identity
        role = identity["role"]
        limiter_key = "firebase:" + identity["uid"]
    else:
        request.state.identity = {
            "uid": "service:" + role,
            "role": role,
            "merchant_id": settings.firebase_merchant_id,
            "email": "",
        }
        limiter_key = token
    await request.app.state.limiter.check(limiter_key)
    return role


async def administrator(role=Depends(principal)):
    if role != "admin":
        raise HTTPException(403, "Administrator access required")
    return role
