"""Mock AI implementations used when MOCK_AI=true. No external calls, ever."""

import io
import random
import time

from PIL import Image, ImageDraw


def refine(title: str, body: str, message: str) -> tuple[str, str, str]:
    """Canned refine: derives title/body from the message, no LLM call."""
    message = (message or "").strip()
    if title and title.strip():
        # Treat a non-empty title as a sign this is a refinement; keep it.
        new_title = title
    else:
        words = message.split()[:6]
        new_title = " ".join(w.capitalize() for w in words) if words else "Untitled"

    sentence = f" Incorporating: {message}" if message else ""
    new_body = (body or "") + sentence
    reply = "Updated the concept."
    return new_title, new_body, reply


def compile(body: str, parent_notes: list[str]) -> str:
    """Canned compile: the body plus one line per parent image note."""
    lines = [body or ""]
    lines.extend(parent_notes)
    return "\n".join(line for line in lines if line)


def _pastel_color() -> tuple[int, int, int]:
    return tuple(random.randint(180, 255) for _ in range(3))


def generate_images(
    prompt: str,
    reference_paths: list[str],
    n: int,
    quality: str,
    size: str,
) -> list[bytes]:
    """Sleeps briefly, then returns n placeholder PNGs with the prompt text on them."""
    time.sleep(2)
    text = (prompt or "")[:40]
    results = []
    for _ in range(n):
        img = Image.new("RGB", (1024, 1024), _pastel_color())
        draw = ImageDraw.Draw(img)
        bbox = draw.textbbox((0, 0), text)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text(((1024 - w) / 2, (1024 - h) / 2), text, fill=(30, 30, 30))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        results.append(buf.getvalue())
    return results
