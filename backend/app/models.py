from sqlalchemy import JSON, Column, Float, String, Text

from app.db import Base


class ConceptNode(Base):
    __tablename__ = "concept_nodes"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False, default="")
    body = Column(Text, nullable=False, default="")
    status = Column(String, nullable=False, default="draft")  # draft | committed
    compiled_prompt = Column(Text, nullable=True)
    position_x = Column(Float, nullable=False, default=0.0)
    position_y = Column(Float, nullable=False, default=0.0)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class ImageNode(Base):
    __tablename__ = "image_nodes"

    id = Column(String, primary_key=True)
    source = Column(String, nullable=False)  # generated | uploaded
    file_path = Column(String, nullable=False)
    feedback = Column(Text, nullable=False, default="")
    concept_id = Column(String, nullable=True)  # producing concept, null for uploaded
    generation_id = Column(String, nullable=True)
    position_x = Column(Float, nullable=False, default=0.0)
    position_y = Column(Float, nullable=False, default=0.0)
    created_at = Column(String, nullable=False)


class Edge(Base):
    __tablename__ = "edges"

    id = Column(String, primary_key=True)
    source_id = Column(String, nullable=False)  # parent: concept or image node
    target_id = Column(String, nullable=False)  # child: concept node


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(String, primary_key=True)
    image_node_id = Column(String, nullable=False)
    kind = Column(String, nullable=False)  # like | dislike | note
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    w = Column(Float, nullable=False)
    h = Column(Float, nullable=False)
    note = Column(Text, nullable=False, default="")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True)
    concept_id = Column(String, nullable=False)
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False, default="")
    attached_image_ids = Column(JSON, nullable=False, default=list)
    created_at = Column(String, nullable=False)


class Generation(Base):
    __tablename__ = "generations"

    id = Column(String, primary_key=True)
    concept_id = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    model = Column(String, nullable=False)
    quality = Column(String, nullable=False)
    size = Column(String, nullable=False)
    reference_image_ids = Column(JSON, nullable=False, default=list)
    status = Column(String, nullable=False, default="running")  # running | done | failed
    error = Column(Text, nullable=True)
    image_node_ids = Column(JSON, nullable=False, default=list)
    created_at = Column(String, nullable=False)
