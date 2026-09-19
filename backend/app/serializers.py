"""ORM-model -> Pydantic-schema conversion helpers, shared across routers."""

import os

from sqlalchemy.orm import Session

from app import models, schemas


def get_parent_ids(db: Session, concept_id: str) -> list[str]:
    edges = db.query(models.Edge).filter(models.Edge.target_id == concept_id).all()
    return [e.source_id for e in edges]


def concept_to_schema(concept: models.ConceptNode, parent_ids: list[str]) -> schemas.ConceptNode:
    return schemas.ConceptNode(
        id=concept.id,
        type="concept",
        title=concept.title,
        body=concept.body,
        status=concept.status,
        compiled_prompt=concept.compiled_prompt,
        parent_ids=parent_ids,
        position=schemas.Position(x=concept.position_x, y=concept.position_y),
        created_at=concept.created_at,
        updated_at=concept.updated_at,
    )


def annotation_to_schema(annotation: models.Annotation) -> schemas.Annotation:
    return schemas.Annotation(
        id=annotation.id,
        image_node_id=annotation.image_node_id,
        kind=annotation.kind,
        x=annotation.x,
        y=annotation.y,
        w=annotation.w,
        h=annotation.h,
        note=annotation.note,
    )


def image_url(file_path: str) -> str:
    return f"/images/{os.path.basename(file_path)}"


def image_to_schema(db: Session, image: models.ImageNode) -> schemas.ImageNode:
    annotations = (
        db.query(models.Annotation)
        .filter(models.Annotation.image_node_id == image.id)
        .all()
    )
    return schemas.ImageNode(
        id=image.id,
        type="image",
        source=image.source,
        url=image_url(image.file_path),
        feedback=image.feedback,
        concept_id=image.concept_id,
        generation_id=image.generation_id,
        annotations=[annotation_to_schema(a) for a in annotations],
        position=schemas.Position(x=image.position_x, y=image.position_y),
        created_at=image.created_at,
    )


def chat_message_to_schema(message: models.ChatMessage) -> schemas.ChatMessage:
    return schemas.ChatMessage(
        id=message.id,
        concept_id=message.concept_id,
        role=message.role,
        content=message.content,
        attached_image_ids=list(message.attached_image_ids or []),
        created_at=message.created_at,
    )


def generation_to_schema(generation: models.Generation) -> schemas.Generation:
    return schemas.Generation(
        id=generation.id,
        concept_id=generation.concept_id,
        prompt=generation.prompt,
        model=generation.model,
        quality=generation.quality,
        size=generation.size,
        reference_image_ids=list(generation.reference_image_ids or []),
        status=generation.status,
        error=generation.error,
        image_node_ids=list(generation.image_node_ids or []),
        created_at=generation.created_at,
    )
