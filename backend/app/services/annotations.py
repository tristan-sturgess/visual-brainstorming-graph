"""Serializes an image node's feedback and annotations as text for the LLMs.

See "How annotations are serialized for the LLMs" in docs/api.md.
"""

from app import models


def _grid_location(x: float, y: float, w: float, h: float) -> str:
    cx = x + w / 2
    cy = y + h / 2

    if cy < 1 / 3:
        row = "top"
    elif cy < 2 / 3:
        row = "middle"
    else:
        row = "bottom"

    if cx < 1 / 3:
        col = "left"
    elif cx < 2 / 3:
        col = "center"
    else:
        col = "right"

    if row == "middle" and col == "center":
        return "center"
    return f"{row} {col}"


def serialize_image_context(image: models.ImageNode, annotations: list[models.Annotation]) -> str:
    short_id = image.id[:8]
    feedback = image.feedback if image.feedback else "none"
    lines = [f'Image {short_id} ({image.source}) feedback: "{feedback}"']
    for annotation in annotations:
        location = _grid_location(annotation.x, annotation.y, annotation.w, annotation.h)
        lines.append(f'  - {annotation.kind}, {location}: "{annotation.note}"')
    return "\n".join(lines)
