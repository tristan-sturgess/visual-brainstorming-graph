"""Commit-or-reuse generation logic, plus the background task that calls the
image generator and creates the resulting image nodes.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.db import SessionLocal
from app.services.compile import compile_prompt


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def start_generation(db: Session, concept: models.ConceptNode) -> models.Generation:
    """First call on a draft: commits the concept and compiles the prompt once.
    Later calls: copies prompt/reference_image_ids/settings from the concept's
    first generation. Either way, creates and returns a new `running` Generation.
    """
    if concept.status == "draft":
        parent_ids = (
            db.query(models.Edge.source_id)
            .filter(models.Edge.target_id == concept.id)
            .all()
        )
        parent_ids = [row[0] for row in parent_ids]
        parent_images = (
            db.query(models.ImageNode).filter(models.ImageNode.id.in_(parent_ids)).all()
            if parent_ids
            else []
        )

        prompt = compile_prompt(db, concept, parent_images)
        concept.compiled_prompt = prompt
        concept.status = "committed"
        concept.updated_at = now_iso()

        reference_image_ids = [img.id for img in parent_images]
        model = settings.image_model
        quality = settings.image_quality
        size = settings.image_size
    else:
        first_generation = (
            db.query(models.Generation)
            .filter(models.Generation.concept_id == concept.id)
            .order_by(models.Generation.created_at.asc())
            .first()
        )
        prompt = first_generation.prompt
        reference_image_ids = list(first_generation.reference_image_ids or [])
        model = first_generation.model
        quality = first_generation.quality
        size = first_generation.size

    generation = models.Generation(
        id=uuid.uuid4().hex,
        concept_id=concept.id,
        prompt=prompt,
        model=model,
        quality=quality,
        size=size,
        reference_image_ids=reference_image_ids,
        status="running",
        error=None,
        image_node_ids=[],
        created_at=now_iso(),
    )
    db.add(generation)
    db.commit()
    db.refresh(generation)
    return generation


def _call_image_model(prompt: str, reference_paths: list[str], n: int, quality: str, size: str) -> list[bytes]:
    if settings.mock_ai:
        from app.ai import mock as ai_mock

        return ai_mock.generate_images(prompt, reference_paths, n, quality, size)

    from app.ai import openai_images

    return openai_images.generate_images(prompt, reference_paths, n, quality, size)


def run_generation(generation_id: str) -> None:
    """Background task. Opens its own DB session."""
    db = SessionLocal()
    try:
        generation = (
            db.query(models.Generation).filter(models.Generation.id == generation_id).first()
        )
        if generation is None:
            return
        concept = (
            db.query(models.ConceptNode).filter(models.ConceptNode.id == generation.concept_id).first()
        )

        try:
            reference_paths = [
                img.file_path
                for img in db.query(models.ImageNode)
                .filter(models.ImageNode.id.in_(generation.reference_image_ids or []))
                .all()
            ]

            images = _call_image_model(
                generation.prompt,
                reference_paths,
                settings.candidate_count,
                generation.quality,
                generation.size,
            )

            images_dir = settings.data_dir_path / "images"
            images_dir.mkdir(parents=True, exist_ok=True)

            n = len(images)
            spacing = 280.0
            start_x = concept.position_x - (n - 1) * spacing / 2
            y = concept.position_y + 260.0

            image_ids = []
            for i, png_bytes in enumerate(images):
                image_id = uuid.uuid4().hex
                path = images_dir / f"{image_id}.png"
                path.write_bytes(png_bytes)

                node = models.ImageNode(
                    id=image_id,
                    source="generated",
                    file_path=str(path),
                    feedback="",
                    concept_id=concept.id,
                    generation_id=generation.id,
                    position_x=start_x + i * spacing,
                    position_y=y,
                    created_at=now_iso(),
                )
                db.add(node)
                image_ids.append(image_id)

            generation.status = "done"
            generation.image_node_ids = image_ids
            db.commit()
        except Exception as exc:  # noqa: BLE001 - record any failure on the generation row
            generation.status = "failed"
            generation.error = str(exc)
            db.commit()
    finally:
        db.close()
