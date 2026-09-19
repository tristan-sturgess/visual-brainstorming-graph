import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.db import get_db
from app.serializers import annotation_to_schema, image_to_schema

router = APIRouter(prefix="/api", tags=["images"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_image_or_404(db: Session, image_id: str) -> models.ImageNode:
    image = db.query(models.ImageNode).filter(models.ImageNode.id == image_id).first()
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.post("/images/upload", response_model=schemas.ImageNode, status_code=201)
def upload_image(
    file: UploadFile = File(...),
    x: float = Form(...),
    y: float = Form(...),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Unsupported file type")

    images_dir = settings.data_dir_path / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    image_id = uuid.uuid4().hex
    path = images_dir / f"{image_id}{ext}"
    path.write_bytes(file.file.read())

    image = models.ImageNode(
        id=image_id,
        source="uploaded",
        file_path=str(path),
        feedback="",
        concept_id=None,
        generation_id=None,
        position_x=x,
        position_y=y,
        created_at=now_iso(),
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image_to_schema(db, image)


@router.patch("/images/{image_id}", response_model=schemas.ImageNode)
def patch_image(image_id: str, body: schemas.ImagePatch, db: Session = Depends(get_db)):
    image = _get_image_or_404(db, image_id)

    if body.feedback is not None:
        image.feedback = body.feedback
    if body.position is not None:
        image.position_x = body.position.x
        image.position_y = body.position.y

    db.commit()
    db.refresh(image)
    return image_to_schema(db, image)


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: str, db: Session = Depends(get_db)):
    image = _get_image_or_404(db, image_id)
    if image.source == "generated":
        raise HTTPException(status_code=409, detail="Cannot delete a generated image")

    referencing_committed = (
        db.query(models.Edge)
        .join(models.ConceptNode, models.Edge.target_id == models.ConceptNode.id)
        .filter(models.Edge.source_id == image_id, models.ConceptNode.status == "committed")
        .first()
    )
    if referencing_committed is not None:
        raise HTTPException(status_code=409, detail="A committed concept references this image")

    db.query(models.Edge).filter(models.Edge.source_id == image_id).delete()
    db.query(models.Annotation).filter(models.Annotation.image_node_id == image_id).delete()

    file_path = Path(image.file_path)
    db.delete(image)
    db.commit()

    if file_path.exists():
        file_path.unlink()
    return None


@router.post("/images/{image_id}/annotations", response_model=schemas.Annotation, status_code=201)
def add_annotation(image_id: str, body: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    _get_image_or_404(db, image_id)

    annotation = models.Annotation(
        id=uuid.uuid4().hex,
        image_node_id=image_id,
        kind=body.kind,
        x=body.x,
        y=body.y,
        w=body.w,
        h=body.h,
        note=body.note,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return annotation_to_schema(annotation)


@router.delete("/annotations/{annotation_id}", status_code=204)
def delete_annotation(annotation_id: str, db: Session = Depends(get_db)):
    annotation = db.query(models.Annotation).filter(models.Annotation.id == annotation_id).first()
    if annotation is None:
        raise HTTPException(status_code=404, detail="Annotation not found")
    db.delete(annotation)
    db.commit()
    return None
