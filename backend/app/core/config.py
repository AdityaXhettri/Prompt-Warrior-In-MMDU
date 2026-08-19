"""Configuration loaded from environment variables.

Centralized settings so the rest of the backend never touches os.environ directly.
Fail-soft defaults are used when external services are not configured so the
hackathon demo still works without keys.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General ---
    app_name: str = "SafetyNet API"
    env: str = Field(default="development")
    cors_origins: List[str] = Field(default_factory=lambda: ["*"])

    # --- Supabase ---
    supabase_url: str = Field(default="")
    supabase_anon_key: str = Field(default="")
    supabase_service_key: str = Field(default="")
    use_supabase: bool = Field(default=False)

    # --- Google Maps Platform ---
    google_maps_api_key: str = Field(default="")
    use_google_maps: bool = Field(default=False)

    # --- Twilio ---
    twilio_account_sid: str = Field(default="")
    twilio_auth_token: str = Field(default="")
    twilio_from_number: str = Field(default="")
    use_twilio: bool = Field(default=False)

    # --- AI / LLM ---
    llm_api_key: str = Field(default="")
    llm_base_url: str = Field(default="https://api.openai.com/v1")
    llm_model: str = Field(default="gpt-4o-mini")
    use_llm: bool = Field(default=False)

    # --- Backend behavior ---
    check_in_grace_seconds: int = 120
    eta_delay_threshold_s: int = 300
    inactivity_threshold_s: int = 180
    route_deviation_m: int = 200
    offline_buffer_max: int = 1000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
