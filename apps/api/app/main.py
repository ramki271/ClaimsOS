from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes.claims import router as claims_router
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.policies import router as policies_router
from app.api.v1.routes.providers import router as providers_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="ClaimsOS MVP backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(claims_router, prefix=settings.api_prefix)
app.include_router(policies_router, prefix=settings.api_prefix)
app.include_router(providers_router, prefix=settings.api_prefix)
