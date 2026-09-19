from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.serializers import generation_to_schema

router = APIRouter(prefix="/api/generations", tags=["generations"])


@router.get("/{generation_id}", response_model=schemas.Generation)
def get_generation(generation_id: str, db: Session = Depends(get_db)):
    generation = db.query(models.Generation).filter(models.Generation.id == generation_id).first()
    if generation is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return generation_to_schema(generation)
