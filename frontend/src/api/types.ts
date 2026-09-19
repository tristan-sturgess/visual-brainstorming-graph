// Hand-written TypeScript types mirroring docs/api.md. Keep in sync with that
// document; it is the source of truth for the HTTP contract.

export type Position = { x: number; y: number };

export type ConceptNode = {
  id: string;
  type: "concept";
  title: string; // "" while empty draft
  body: string; // "" while empty draft
  status: "draft" | "committed";
  compiled_prompt: string | null; // set on commit
  parent_ids: string[]; // concept and/or image node ids
  position: Position;
  created_at: string;
  updated_at: string;
};

export type Annotation = {
  id: string;
  image_node_id: string;
  kind: "like" | "dislike" | "note";
  x: number;
  y: number;
  w: number;
  h: number; // normalized 0..1, relative to the image
  note: string; // "" allowed for like/dislike; required non-empty for note
};

export type ImageNode = {
  id: string;
  type: "image";
  source: "generated" | "uploaded";
  url: string; // "/images/<filename>", served statically
  feedback: string;
  concept_id: string | null; // producing concept; null for uploaded
  generation_id: string | null; // null for uploaded
  annotations: Annotation[];
  position: Position;
  created_at: string;
};

export type Edge = {
  id: string;
  source_id: string; // parent: a committed concept or an image node
  target_id: string; // child: a concept node
};
// Note: the edge from a committed concept to each image it generated is NOT
// stored as an Edge row. The frontend derives it from ImageNode.concept_id.

export type Graph = {
  concepts: ConceptNode[];
  images: ImageNode[];
  edges: Edge[];
};

export type ChatMessage = {
  id: string;
  concept_id: string;
  role: "user" | "assistant";
  content: string;
  attached_image_ids: string[]; // image nodes dragged into the composer
  created_at: string;
};

export type Generation = {
  id: string;
  concept_id: string;
  prompt: string; // the frozen compiled prompt
  model: string;
  quality: string;
  size: string;
  reference_image_ids: string[]; // frozen at commit
  status: "running" | "done" | "failed";
  error: string | null;
  image_node_ids: string[]; // filled when done
  created_at: string;
};

// --- Request bodies (not verbatim in api.md, but implied by the endpoints) ---

export type CreateConceptRequest = {
  position: Position;
  parent_ids: string[];
};

export type PatchConceptRequest = {
  title?: string;
  body?: string;
  position?: Position;
};

export type AddParentRequest = {
  node_id: string;
};

export type PostChatRequest = {
  content: string;
  attached_image_ids: string[];
};

export type PostChatResponse = {
  concept: ConceptNode;
  messages: ChatMessage[];
};

export type PatchImageRequest = {
  feedback?: string;
  position?: Position;
};

export type CreateAnnotationRequest = {
  kind: "like" | "dislike" | "note";
  x: number;
  y: number;
  w: number;
  h: number;
  note: string;
};

export type ApiErrorBody = {
  detail: string;
};
