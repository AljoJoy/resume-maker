""" from pathlib import Path

import sentry_sdk
from fastapi import FastAPI, UploadFile, Form
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
import pypdf, io

from app.api.main import api_router
from app.core.config import settings
import logging

CURRENT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = CURRENT_DIR / "frontend"


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.FASTAPI_ENV != "development":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    force=True,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

app.include_router(api_router, prefix=settings.API_V1_STR)

app.frontend("/", directory=FRONTEND_DIR)

# Wrap the complete application so CORS headers are also present on errors.
app = CORSMiddleware(
    app=app,
    allow_origins=[settings.FRONTEND_HOST],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

 """

import logging
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.api.main import api_router
from app.core.config import settings

CURRENT_DIR = Path(__file__).resolve().parent
# Look one level up for the actual frontend dist directory built by the workflow
FRONTEND_DIR = CURRENT_DIR.parent.parent / "frontend" / "dist"


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.FASTAPI_ENV != "development":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    force=True,
)

# 1. Initialize the FastAPI core application instance
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

# 2. Add CORS Middleware correctly (This leaves 'app' as a FastAPI instance)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.FRONTEND_HOST)],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include API Routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# 4. Mount the frontend safely so it doesn't crash if the folder isn't generated yet
if FRONTEND_DIR.exists():
    app.frontend("/", directory=str(FRONTEND_DIR))
else:
    logging.warning(f"Frontend static directory not found at: {FRONTEND_DIR}")