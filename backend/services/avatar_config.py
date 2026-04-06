"""Shared checks for optional OpenAI image (DALL-E) avatar generation."""

import os


def is_avatar_image_generation_enabled() -> bool:
    if os.environ.get("ENABLE_AVATAR_GENERATION", "false").lower() not in {"1", "true", "yes"}:
        return False
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())
