"""Routes package."""
from fastapi import APIRouter

from . import ai, journeys, realtime, simulator, status, users

api_router = APIRouter()
api_router.include_router(status.router)
api_router.include_router(users.router)
api_router.include_router(journeys.router)
api_router.include_router(simulator.router)
api_router.include_router(ai.router)
api_router.include_router(realtime.router)
