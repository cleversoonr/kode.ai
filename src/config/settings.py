"""
┌──────────────────────────────────────────────────────────────────────────────┐
│ @author: Davidson Gomes                                                      │
│ @file: settings.py                                                           │
│ Developed by: Davidson Gomes                                                 │
│ Creation date: May 13, 2025                                                  │
│ Contact: contato@evolution-api.com                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ @copyright © Evolution API 2025. All rights reserved.                        │
│ Licensed under the Apache License, Version 2.0                               │
│                                                                              │
│ You may not use this file except in compliance with the License.             │
│ You may obtain a copy of the License at                                      │
│                                                                              │
│    http://www.apache.org/licenses/LICENSE-2.0                                │
│                                                                              │
│ Unless required by applicable law or agreed to in writing, software          │
│ distributed under the License is distributed on an "AS IS" BASIS,            │
│ WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.     │
│ See the License for the specific language governing permissions and          │
│ limitations under the License.                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ @important                                                                   │
│ For any future changes to the code in this file, it is recommended to        │
│ include, together with the modification, the information of the developer    │
│ who changed it and the date of modification.                                 │
└──────────────────────────────────────────────────────────────────────────────┘
"""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
import secrets
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Settings(BaseSettings):
    """Project settings"""

    # API settings
    API_TITLE: str = os.getenv("API_TITLE", "Kode AI API")
    API_DESCRIPTION: str = os.getenv("API_DESCRIPTION", "API for executing AI agents")
    API_VERSION: str = os.getenv("API_VERSION", "1.0.0")
    API_URL: str = os.getenv("API_URL", "http://localhost:8000")

    # Organization settings
    ORGANIZATION_NAME: str = os.getenv("ORGANIZATION_NAME", "Kode AI")
    ORGANIZATION_URL: str = os.getenv(
        "ORGANIZATION_URL", "https://kodedigital.com.br"
    )

    # Database settings
    POSTGRES_CONNECTION_STRING: str = os.getenv(
        "POSTGRES_CONNECTION_STRING", "postgresql://postgres:208a954bc90040cb9d9bf78a058e1bc2@5.78.73.168:5432/kode_ai"
    )

    # AI engine settings
    AI_ENGINE: str = os.getenv("AI_ENGINE", "adk")
    VECTOR_STORE_PROVIDER: str = os.getenv("VECTOR_STORE_PROVIDER", "pgvector")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "gpt-4.1")
    EMBEDDING_BASE_URL: Optional[str] = os.getenv("EMBEDDING_BASE_URL", "https://openrouter.ai/api/v1")
    EMBEDDING_API_KEY: Optional[str] = os.getenv("EMBEDDING_API_KEY")
    EMBEDDING_DIMENSIONS: int = int(os.getenv("EMBEDDING_DIMENSIONS", 1536))
    MAX_CHUNK_TOKENS: int = int(os.getenv("MAX_CHUNK_TOKENS", 512))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", 128))
    KNOWLEDGE_STORAGE_PATH: str = os.getenv("KNOWLEDGE_STORAGE_PATH", "static/knowledge")
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", 25))
    KNOWLEDGE_ALLOWED_MIME_TYPES: List[str] = os.getenv(
        "KNOWLEDGE_ALLOWED_MIME_TYPES",
        "application/pdf,text/plain,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ).split(",")

    # Logging settings
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = "logs"

    # Redis settings
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")
    REDIS_SSL: bool = os.getenv("REDIS_SSL", "false").lower() == "true"
    REDIS_KEY_PREFIX: str = os.getenv("REDIS_KEY_PREFIX", "evoai:")
    REDIS_TTL: int = int(os.getenv("REDIS_TTL", 3600))

    # Tool cache TTL in seconds (1 hour)
    TOOLS_CACHE_TTL: int = int(os.getenv("TOOLS_CACHE_TTL", 3600))

    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRATION_TIME: int = int(os.getenv("JWT_EXPIRATION_TIME", 3600))

    # Encryption settings
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", secrets.token_urlsafe(32))

    # Email provider settings
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "sendgrid")

    # SendGrid settings
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@yourdomain.com")

    # SMTP settings
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.google.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER", "kodedigital@gmail.com")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "Ks@475869")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_USE_SSL: bool = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    SMTP_FROM: str = os.getenv("SMTP_FROM", "kodedigital@gmail.com")

    APP_URL: str = os.getenv("APP_URL", "http://localhost:8000")

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # CORS settings
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "*").split(",")

    # Token settings
    TOKEN_EXPIRY_HOURS: int = int(
        os.getenv("TOKEN_EXPIRY_HOURS", 24)
    )  # Verification/reset tokens

    # Security settings
    PASSWORD_MIN_LENGTH: int = int(os.getenv("PASSWORD_MIN_LENGTH", 8))
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", 5))
    LOGIN_LOCKOUT_MINUTES: int = int(os.getenv("LOGIN_LOCKOUT_MINUTES", 30))

    # Seeder settings
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@evoai.com")
    ADMIN_INITIAL_PASSWORD: str = os.getenv(
        "ADMIN_INITIAL_PASSWORD", "strongpassword123"
    )
    DEMO_EMAIL: str = os.getenv("DEMO_EMAIL", "demo@example.com")
    DEMO_PASSWORD: str = os.getenv("DEMO_PASSWORD", "demo123")
    DEMO_CLIENT_NAME: str = os.getenv("DEMO_CLIENT_NAME", "Demo Client")

    # Langfuse / OpenTelemetry settings
    LANGFUSE_PUBLIC_KEY: str = os.getenv("LANGFUSE_PUBLIC_KEY", "pk-lf-0bc949f9-a009-4170-b369-226dba072ce4")
    LANGFUSE_SECRET_KEY: str = os.getenv("LANGFUSE_SECRET_KEY", "sk-lf-beeda2ec-4ea1-44b6-8282-5355063d7c3f")
    OTEL_EXPORTER_OTLP_ENDPOINT: str = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://us.cloud.langfuse.com")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
