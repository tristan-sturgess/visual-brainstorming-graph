import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.serializers import chat_message_to_schema, concept_to_schema, generation_to_schema, get_parent_ids
from app.services.generation import run_generation, start_generation
from app.services.refine import refine

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_concept_or_404(db: Session, concept_id: str) -> models.ConceptNode:
    concept = db.query(models.ConceptNode).filter(models.ConceptNode.id == concept_id).first()
    if concept is None:
        raise HTTPException(status_code=404, detail="Concept not found")
    return concept


def _get_image(db: Session, node_id: str):
    return db.query(models.ImageNode).filter(models.ImageNode.id == node_id).first()


@router.post("", response_model=schemas.ConceptNode, status_code=201)
def create_concept(body: schemas.ConceptCreate, db: Session = Depends(get_db)):
    concept_id = uuid.uuid4().hex

    # Validate every parent: must exist, and must be a committed concept or any image node.
    parent_nodes = []  # list of (kind, orm_object), in request order
    for pid in body.parent_ids:
        concept_parent = db.query(models.ConceptNode).filter(models.ConceptNode.id == pid).first()
        if concept_parent is not None:
            if concept_parent.status == "draft":
                raise HTTPException(status_code=409, detail="A draft concept cannot be a parent")
            parent_nodes.append(("concept", concept_parent))
            continue

        image_parent = _get_image(db, pid)
        if image_parent is not None:
            parent_nodes.append(("image", image_parent))
            continue

        raise HTTPException(status_code=404, detail=f"Parent node {pid} not found")

    title, body_text = "", ""
    if parent_nodes:
        kind, first = parent_nodes[0]
        if kind == "concept":
            title, body_text = first.title, first.body
        elif kind == "image" and first.source == "generated" and first.concept_id:
            producing = (
                db.query(models.ConceptNode).filter(models.ConceptNode.id == first.concept_id).first()
            )
            if producing is not None:
                title, body_text = producing.title, producing.body
        # uploaded image as first parent: leave title/body empty.

    now = now_iso()
    concept = models.ConceptNode(
        id=concept_id,
        title=title,
        body=body_text,
        status="draft",
        compiled_prompt=None,
        position_x=body.position.x,
        position_y=body.position.y,
        created_at=now,
        updated_at=now,
    )
    db.add(concept)
    for pid in body.parent_ids:
        db.add(models.Edge(id=uuid.uuid4().hex, source_id=pid, target_id=concept_id))
    db.commit()
    db.refresh(concept)

    return concept_to_schema(concept, get_parent_ids(db, concept.id))


@router.patch("/{concept_id}", response_model=schemas.ConceptNode)
def patch_concept(concept_id: str, body: schemas.ConceptPatch, db: Session = Depends(get_db)):
    concept = _get_concept_or_404(db, concept_id)

    if (body.title is not None or body.body is not None) and concept.status == "committed":
        raise HTTPException(status_code=409, detail="Cannot edit text of a committed concept")

    if body.title is not None:
        concept.title = body.title
    if body.body is not None:
        concept.body = body.body
    if body.position is not None:
        concept.position_x = body.position.x
        concept.position_y = body.position.y

    concept.updated_at = now_iso()
    db.commit()
    db.refresh(concept)
    return concept_to_schema(concept, get_parent_ids(db, concept.id))


@router.delete("/{concept_id}", status_code=204)
def delete_concept(concept_id: str, db: Session = Depends(get_db)):
    concept = _get_concept_or_404(db, concept_id)
    if concept.status == "committed":
        raise HTTPException(status_code=409, detail="Cannot delete a committed concept")

    db.query(models.Edge).filter(models.Edge.target_id == concept_id).delete()
    db.query(models.ChatMessage).filter(models.ChatMessage.concept_id == concept_id).delete()
    db.delete(concept)
    db.commit()
    return None


@router.post("/{concept_id}/parents", response_model=schemas.ConceptNode)
def add_parent(concept_id: str, body: schemas.ParentAdd, db: Session = Depends(get_db)):
    concept = _get_concept_or_404(db, concept_id)
    if concept.status == "committed":
        raise HTTPException(status_code=409, detail="Cannot modify parents of a committed concept")

    node_id = body.node_id
    if node_id == concept_id:
        raise HTTPException(status_code=409, detail="A concept cannot be its own parent")

    concept_parent = db.query(models.ConceptNode).filter(models.ConceptNode.id == node_id).first()
    image_parent = None if concept_parent is not None else _get_image(db, node_id)
    if concept_parent is None and image_parent is None:
        raise HTTPException(status_code=404, detail="Node not found")
    if concept_parent is not None and concept_parent.status == "draft":
        raise HTTPException(status_code=409, detail="A draft concept cannot be a parent")

    existing = (
        db.query(models.Edge)
        .filter(models.Edge.source_id == node_id, models.Edge.target_id == concept_id)
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already a parent")

    db.add(models.Edge(id=uuid.uuid4().hex, source_id=node_id, target_id=concept_id))
    db.commit()
    db.refresh(concept)
    return concept_to_schema(concept, get_parent_ids(db, concept.id))


@router.delete("/{concept_id}/parents/{node_id}", response_model=schemas.ConceptNode)
def remove_parent(concept_id: str, node_id: str, db: Session = Depends(get_db)):
    concept = _get_concept_or_404(db, concept_id)
    if concept.status == "committed":
        raise HTTPException(status_code=409, detail="Cannot modify parents of a committed concept")

    edge = (
        db.query(models.Edge)
        .filter(models.Edge.source_id == node_id, models.Edge.target_id == concept_id)
        .first()
    )
    if edge is None:
        raise HTTPException(status_code=404, detail="Parent edge not found")

    db.delete(edge)
    db.commit()
    db.refresh(concept)
    return concept_to_schema(concept, get_parent_ids(db, concept.id))


@router.get("/{concept_id}/chat", response_model=list[schemas.ChatMessage])
def list_chat(concept_id: str, db: Session = Depends(get_db)):
    _get_concept_or_404(db, concept_id)
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.concept_id == concept_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    return [chat_message_to_schema(m) for m in messages]


@router.post("/{concept_id}/chat", response_model=schemas.ChatResponse)
def post_chat(concept_id: str, body: schemas.ChatCreate, db: Session = Depends(get_db)):
    concept = _get_concept_or_404(db, concept_id)
    if concept.status == "committed":
        raise HTTPException(status_code=409, detail="Concept is committed and read-only")

    parent_ids = get_parent_ids(db, concept_id)
    parent_concepts = (
        db.query(models.ConceptNode).filter(models.ConceptNode.id.in_(parent_ids)).all()
        if parent_ids
        else []
    )
    parent_images = (
        db.query(models.ImageNode).filter(models.ImageNode.id.in_(parent_ids)).all()
        if parent_ids
        else []
    )
    history = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.concept_id == concept_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    attachments = (
        db.query(models.ImageNode).filter(models.ImageNode.id.in_(body.attached_image_ids)).all()
        if body.attached_image_ids
        else []
    )

    title, new_body, reply = refine(
        db, concept, parent_concepts, parent_images, history, attachments, body.content
    )

    now = now_iso()
    user_msg = models.ChatMessage(
        id=uuid.uuid4().hex,
        concept_id=concept_id,
        role="user",
        content=body.content,
        attached_image_ids=list(body.attached_image_ids),
        created_at=now,
    )
    db.add(user_msg)

    concept.title = title
    concept.body = new_body
    concept.updated_at = now_iso()
    db.commit()

    assistant_msg = models.ChatMessage(
        id=uuid.uuid4().hex,
        concept_id=concept_id,
        role="assistant",
        content=reply,
        attached_image_ids=[],
        created_at=now_iso(),
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(concept)

    return schemas.ChatResponse(
        concept=concept_to_schema(concept, get_parent_ids(db, concept_id)),
        messages=[chat_message_to_schema(user_msg), chat_message_to_schema(assistant_msg)],
    )


@router.post("/{concept_id}/generate", response_model=schemas.Generation, status_code=202)
def generate(concept_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    concept = _get_concept_or_404(db, concept_id)

    if concept.status == "draft" and not concept.body.strip():
        raise HTTPException(status_code=409, detail="Cannot generate from an empty draft")

    running = (
        db.query(models.Generation)
        .filter(models.Generation.concept_id == concept_id, models.Generation.status == "running")
        .first()
    )
    if running is not None:
        raise HTTPException(status_code=409, detail="A generation is already running for this concept")

    generation = start_generation(db, concept)
    background_tasks.add_task(run_generation, generation.id)
    return generation_to_schema(generation)
