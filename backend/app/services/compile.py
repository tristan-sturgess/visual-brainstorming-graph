"""compile_prompt: frozen concept + parent-image notes -> one image-generation prompt.

Mock mode never imports the real client (app.ai.openrouter).
"""

from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.services.annotations import serialize_image_context


def compile_prompt(db: Session, concept: models.ConceptNode, parent_images: list[models.ImageNode]) -> str:
    notes = []
    for image in parent_images:
        annotations = (
            db.query(models.Annotation)
            .filter(models.Annotation.image_node_id == image.id)
            .all()
        )
        notes.append(serialize_image_context(image, annotations))

    if settings.mock_ai:
        from app.ai import mock as ai_mock

        return ai_mock.compile(concept.body, notes)

    from app.ai import openrouter as ai_openrouter

    return ai_openrouter.compile(concept.title, concept.body, notes)
