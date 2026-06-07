from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Prisma-only query params that psycopg rejects
_PRISMA_QUERY_PARAMS = frozenset({"schema"})


def strip_prisma_params(database_url: str) -> str:
    """Remove Prisma-specific URI params (e.g. schema=public) for psycopg."""
    parsed = urlparse(database_url)
    if not parsed.query:
        return database_url
    kept = [(k, v) for k, v in parse_qsl(parsed.query) if k not in _PRISMA_QUERY_PARAMS]
    return urlunparse(parsed._replace(query=urlencode(kept)))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")

    open_router_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPEN_ROUTER_KEY", "OPENROUTER_API_KEY"),
    )
    database_url: str = "postgresql://warmleads:warmleads@localhost:5433/warmleads"
    openrouter_model: str = "google/gemini-2.5-flash"
    openrouter_embed_model: str = "openai/text-embedding-3-small"
    embed_dim: int = 1536
    area_cache_ttl_days: int = 30
    max_buyers_per_research: int = 3
    geocode_use_nominatim: bool = Field(
        default=True,
        validation_alias=AliasChoices("GEOCODE_USE_NOMINATIM"),
    )
    unipile_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("UNIPILE_API_KEY"),
    )
    unipile_base_url: str = Field(
        default="https://api.unipile.com/v2",
        validation_alias=AliasChoices("UNIPILE_BASE_URL"),
    )
    unipile_whatsapp_account_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("UNIPILE_WHATSAPP_ACCOUNT_ID"),
    )
    unipile_email_account_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("UNIPILE_EMAIL_ACCOUNT_ID", "UNIPILE_GMAIL_ACCOUNT_ID"),
    )
    unipile_enable_sends: bool = Field(
        default=True,
        validation_alias=AliasChoices("UNIPILE_ENABLE_SENDS"),
    )
    app_url: str = Field(
        default="http://backend:3001",
        validation_alias=AliasChoices("APP_URL"),
    )
    internal_api_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("INTERNAL_API_TOKEN"),
    )
    unipile_webhook_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("UNIPILE_WEBHOOK_SECRET"),
    )

    @property
    def psycopg_database_url(self) -> str:
        return strip_prisma_params(self.database_url)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.open_router_key and self.open_router_key.strip())

    @property
    def gemini_enabled(self) -> bool:
        """Backward-compatible alias used across the codebase."""
        return self.llm_enabled

    @property
    def unipile_enabled(self) -> bool:
        return bool(self.unipile_api_key and self.unipile_api_key.strip() and self.unipile_enable_sends)


@lru_cache
def get_settings() -> Settings:
    return Settings()
