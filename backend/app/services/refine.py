"""refine: draft concept + full context -> (title, body, assistant reply).

Mock mode never imports the real client (app.ai.openrouter).
"""

from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.services.annotations import serialize_image_context


def _image_texts(db: Session, images: list[models.ImageNode]) -> list[str]:
    texts = []
    for image in images:
        annotations = (
            db.query(models.Annotation)
            .filter(models.Annotation.image_node_id == image.id)
            .all()
        )
        texts.append(serialize_image_context(image, annotations))
    return texts


def refine(
    db: Session,
    concept: models.ConceptNode,
    parent_concepts: list[models.ConceptNode],
    parent_images: list[models.ImageNode],
    history: list[models.ChatMessage],
    attachments: list[models.ImageNode],
    message: str,
) -> tuple[str, str, str]:
    if settings.mock_ai:
        from app.ai import mock as ai_mock

        return ai_mock.refine(concept.title, concept.body, message)

    from app.ai import openrouter as ai_openrouter

    parent_concept_texts = [f"{c.title}: {c.body}" for c in parent_concepts]
    parent_image_texts = _image_texts(db, parent_images)
    parent_image_paths = [i.file_path for i in parent_images]
    attachment_texts = _image_texts(db, attachments)
    attachment_paths = [i.file_path for i in attachments]
    history_lines = [f"{m.role}: {m.content}" for m in history]

    return ai_openrouter.refine(
        title=concept.title,
        body=concept.body,
        parent_concept_texts=parent_concept_texts,
        parent_image_texts=parent_image_texts,
        parent_image_paths=parent_image_paths,
        history_lines=history_lines,
        attachment_texts=attachment_texts,
        attachment_paths=attachment_paths,
        message=message,
    )
