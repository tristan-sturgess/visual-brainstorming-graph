# API Contract

The HTTP contract between the FastAPI backend and the React frontend. Both sides are written by hand against this document. JSON everywhere except upload. All ids are UUID strings. All timestamps are ISO 8601 strings.

The backend listens on `http://localhost:8000`. The Vite dev server proxies `/api` and `/images` to it.

## Types

```ts
type Position = { x: number; y: number };

type ConceptNode = {
  id: string;
  type: "concept";
  title: string;                 // "" while empty draft
  body: string;                  // "" while empty draft
  status: "draft" | "committed";
  compiled_prompt: string | null; // set on commit
  parent_ids: string[];          // concept and/or image node ids
  position: Position;
  created_at: string;
  updated_at: string;
};

type Annotation = {
  id: string;
  image_node_id: string;
  kind: "like" | "dislike" | "note";
  x: number; y: number; w: number; h: number; // normalized 0..1, relative to the image
  note: string;                  // "" allowed for like/dislike; required non-empty for note
};

type ImageNode = {
  id: string;
  type: "image";
  source: "generated" | "uploaded";
  url: string;                   // "/images/<filename>", served statically
  feedback: string;
  concept_id: string | null;     // producing concept; null for uploaded
  generation_id: string | null;  // null for uploaded
  annotations: Annotation[];
  position: Position;
  created_at: string;
};

type Edge = {
  id: string;
  source_id: string;             // parent: a committed concept or an image node
  target_id: string;             // child: a concept node
};
// Note: the edge from a committed concept to each image it generated is NOT
// stored as an Edge row. The frontend derives it from ImageNode.concept_id.

type Graph = {
  concepts: ConceptNode[];
  images: ImageNode[];
  edges: Edge[];
};

type ChatMessage = {
  id: string;
  concept_id: string;
  role: "user" | "assistant";
  content: string;
  attached_image_ids: string[];  // image nodes dragged into the composer
  created_at: string;
};

type Generation = {
  id: string;
  concept_id: string;
  prompt: string;                // the frozen compiled prompt
  model: string;
  quality: string;
  size: string;
  reference_image_ids: string[]; // frozen at commit
  status: "running" | "done" | "failed";
  error: string | null;
  image_node_ids: string[];      // filled when done
  created_at: string;
};
```

## Errors

Errors return `{ "detail": "<message>" }` with:

* `404` unknown id;
* `409` an invariant would be violated (see below);
* `422` bad request body (FastAPI default).

## Endpoints

### Graph

`GET /api/graph` → `Graph`. Everything, in one call. The frontend refetches this after any mutation.

### Concepts

`POST /api/concepts` → `ConceptNode` (201)

```json
{ "position": { "x": 0, "y": 0 }, "parent_ids": [] }
```

Creates a draft. If `parent_ids` is non-empty, each parent is validated as below and the draft is **pre-filled**: title and body are copied from the first parent if it is a concept, or from that image's producing concept if it is a generated image. An uploaded image as first parent leaves the draft empty. No LLM call.

`PATCH /api/concepts/{id}` → `ConceptNode`

```json
{ "title": "...", "body": "...", "position": { "x": 1, "y": 2 } }
```

All fields optional. `title` / `body` on a committed concept → `409`. `position` is always allowed.

`DELETE /api/concepts/{id}` → `204`. Committed → `409`. Deleting a draft also deletes its edges and chat messages.

`POST /api/concepts/{id}/parents` → `ConceptNode`

```json
{ "node_id": "..." }
```

Adds a parent. Rules, each a `409`: concept is committed; `node_id` is the concept itself; `node_id` is a draft concept (only committed concepts and image nodes can be parents, which also keeps the graph acyclic); already a parent.

`DELETE /api/concepts/{id}/parents/{node_id}` → `ConceptNode`. Committed → `409`.

### Chat (refine)

`GET /api/concepts/{id}/chat` → `ChatMessage[]` oldest first.

`POST /api/concepts/{id}/chat` → `{ "concept": ConceptNode, "messages": ChatMessage[] }`

```json
{ "content": "Hero illustration for my site...", "attached_image_ids": [] }
```

Committed → `409`. Runs the refine operation synchronously (a few seconds) with: current title/body, parent concept texts, parent images with feedback and annotations, chat history, attached images with their feedback and annotations, and the message. Stores the user message and the assistant reply, updates title/body, returns both new messages. Attached images are never stored anywhere the image generator reads.

### Generate

`POST /api/concepts/{id}/generate` → `Generation` (202)

No body. If the concept is a draft with empty `body` → `409`. If a generation for this concept is already `running` → `409`.

First call on a draft: sets `status = committed`, runs the compiler (concept + parent images' feedback and annotations → prompt), stores `compiled_prompt`, freezes `reference_image_ids` = the parent ids that are image nodes, then creates the generation.

Later calls (Generate more): copies `prompt`, `reference_image_ids`, and settings from the concept's first generation. Never recompiles.

Image generation runs in a FastAPI background task. The response is the `running` generation. When it finishes, image nodes are created with `concept_id` and `generation_id` set and positioned in a row below the concept, and `status` becomes `done` (or `failed` with `error`).

`GET /api/generations/{id}` → `Generation`. The frontend polls this every 2 seconds while `running`, then refetches the graph.

### Images

`POST /api/images/upload` → `ImageNode` (201). `multipart/form-data` with fields `file` (png/jpg/webp), `x`, `y`. Stored under `data/images/`, `source = "uploaded"`.

`PATCH /api/images/{id}` → `ImageNode`

```json
{ "feedback": "...", "position": { "x": 1, "y": 2 } }
```

Both optional. Always allowed, including on generated images (feedback is never frozen).

`DELETE /api/images/{id}` → `204`. `409` if `source = "generated"`, or if any **committed** concept lists it as a parent. Deleting removes edges to drafts and the file.

`POST /api/images/{id}/annotations` → `Annotation` (201)

```json
{ "kind": "like", "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.3, "note": "" }
```

`kind = "note"` with empty `note` → `422`.

`DELETE /api/annotations/{id}` → `204`.

### Static

`GET /images/{filename}` serves files from `data/images/`.

## How annotations are serialized for the LLMs

Both the refiner and the compiler receive parent images described as text, one block per image:

```
Image <short id> (<source>) feedback: "<feedback or none>"
  - like, top left: "the character design"
  - dislike, center: ""
  - note, bottom right: "main light source"
```

Location is the 3x3 grid cell containing the rectangle's center: `top|middle|bottom` × `left|center|right`, written as "top left", "center" (for middle center), etc. The refiner additionally receives the image bytes as vision input. The compiler receives text only. The image generator receives the compiled prompt and the reference image files only.
