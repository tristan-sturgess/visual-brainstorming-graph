"""Real image generation via the OpenAI images API.

Verified against the installed openai==3.16.2 SDK:
- `client.images.generate(model=, prompt=, n=, quality=, size=)` for text-to-image.
- `client.images.edit(model=, image=[...], prompt=, n=, quality=, size=)` for
  image-edit with reference images.
- Both return an `ImagesResponse` whose `.data[i].b64_json` is populated by
  default for GPT image models (no `response_format` needed).
"""

import base64

from openai import OpenAI

from app.config import settings


def generate_images(
    prompt: str,
    reference_paths: list[str],
    n: int,
    quality: str,
    size: str,
) -> list[bytes]:
    client = OpenAI(api_key=settings.openai_api_key)

    if reference_paths:
        files = [open(path, "rb") for path in reference_paths]
        try:
            response = client.images.edit(
                model=settings.image_model,
                image=files,
                prompt=prompt,
                n=n,
                quality=quality,
                size=size,
            )
        finally:
            for f in files:
                f.close()
    else:
        response = client.images.generate(
            model=settings.image_model,
            prompt=prompt,
            n=n,
            quality=quality,
            size=size,
        )

    return [base64.b64decode(item.b64_json) for item in response.data]
