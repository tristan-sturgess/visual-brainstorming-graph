from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.serializers import concept_to_schema, get_parent_ids, image_to_schema

router = APIRouter(prefix="/api", tags=["graph"])


@router.get("/graph", response_model=schemas.Graph)
def get_graph(db: Session = Depends(get_db)):
    concepts = db.query(models.ConceptNode).all()
    images = db.query(models.ImageNode).all()
    edges = db.query(models.Edge).all()

    concept_schemas = [concept_to_schema(c, get_parent_ids(db, c.id)) for c in concepts]
    image_schemas = [image_to_schema(db, i) for i in images]
    edge_schemas = [schemas.Edge(id=e.id, source_id=e.source_id, target_id=e.target_id) for e in edges]

    return schemas.Graph(concepts=concept_schemas, images=image_schemas, edges=edge_schemas)
