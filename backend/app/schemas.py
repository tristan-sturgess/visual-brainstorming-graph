from typing import Literal, Optional

from pydantic import BaseModel, field_validator


class Position(BaseModel):
    x: float
    y: float


class Annotation(BaseModel):
    id: str
    image_node_id: str
    kind: Literal["like", "dislike", "note"]
    x: float
    y: float
    w: float
    h: float
    note: str = ""


class AnnotationCreate(BaseModel):
    kind: Literal["like", "dislike", "note"]
    x: float
    y: float
    w: float
    h: float
    note: str = ""

    @field_validator("note")
    @classmethod
    def note_required_for_note_kind(cls, value: str, info):
        kind = info.data.get("kind")
        if kind == "note" and not value.strip():
            raise ValueError("note is required and cannot be empty when kind is 'note'")
        return value


class ConceptNode(BaseModel):
    id: str
    type: Literal["concept"] = "concept"
    title: str
    body: str
    status: Literal["draft", "committed"]
    compiled_prompt: Optional[str] = None
    parent_ids: list[str] = []
    position: Position
    created_at: str
    updated_at: str


class ImageNode(BaseModel):
    id: str
    type: Literal["image"] = "image"
    source: Literal["generated", "uploaded"]
    url: str
    feedback: str
    concept_id: Optional[str] = None
    generation_id: Optional[str] = None
    annotations: list[Annotation] = []
    position: Position
    created_at: str


class Edge(BaseModel):
    id: str
    source_id: str
    target_id: str


class Graph(BaseModel):
    concepts: list[ConceptNode]
    images: list[ImageNode]
    edges: list[Edge]


class ChatMessage(BaseModel):
    id: str
    concept_id: str
    role: Literal["user", "assistant"]
    content: str
    attached_image_ids: list[str] = []
    created_at: str


class Generation(BaseModel):
    id: str
    concept_id: str
    prompt: str
    model: str
    quality: str
    size: str
    reference_image_ids: list[str] = []
    status: Literal["running", "done", "failed"]
    error: Optional[str] = None
    image_node_ids: list[str] = []
    created_at: str


# --- Request bodies ---


class ConceptCreate(BaseModel):
    position: Position
    parent_ids: list[str] = []


class ConceptPatch(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    position: Optional[Position] = None


class ParentAdd(BaseModel):
    node_id: str


class ChatCreate(BaseModel):
    content: str
    attached_image_ids: list[str] = []


class ChatResponse(BaseModel):
    concept: ConceptNode
    messages: list[ChatMessage]


class ImagePatch(BaseModel):
    feedback: Optional[str] = None
    position: Optional[Position] = None
