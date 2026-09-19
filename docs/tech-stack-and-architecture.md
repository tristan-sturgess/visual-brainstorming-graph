# Tech Stack & Architecture

The proof-of-concept stack and the main architectural decisions for the Visual Brainstorming Graph. The target is a demo that runs on one machine for one user, built quickly.

## Guiding principle

Keep everything conventional and lightweight except the graph-based creative experience. Optimize for:

* fast iteration;
* clear provenance for generated images;
* zero infrastructure;
* a polished graph UI;
* nothing that does not directly prove the product idea.

## Core stack

### Backend

* **Python 3.12+**
* **Poetry** for dependency management
* **FastAPI** for the HTTP API
* **Pydantic** for request/response schemas
* **SQLAlchemy** with **SQLite**, tables created with `create_all` on startup. No Alembic; if the schema changes, delete the database file.
* **pydantic-settings** and a `.env` file for configuration and API keys.

### LLM access

* **OpenRouter** as the model gateway
* **LangChain** for the chat model client and structured output, using an OpenAI-compatible client pointed at OpenRouter
* No LangGraph.

Two LLM operations:

* **refine**: draft concept plus context in, updated concept plus assistant reply out. Needs a **vision-capable model**, since it looks at parent images and chat attachments.
* **compile**: frozen concept plus parent-image notes in, one image-generation prompt out. Text only.

Both model IDs live in config.

### Image generation

The **OpenAI image API** through the official Python SDK (`gpt-image-1` or newer), behind one small module.

* With connected parent images, use the image-edit endpoint with all parent images as input. This is the primary path.
* With no parent images, use text-to-image.
* Request the configured number of candidates in one call (`n`).
* One quality and size setting from config. Prefer a fast, inexpensive setting.

### Frontend

* **React** + **TypeScript** + **Vite**
* **@xyflow/react** (React Flow) for the canvas
* **Zustand** for editor state (selection, chat draft, annotation drawing mode)
* **TanStack Query** for server state, with `refetchInterval` polling while a generation is running
* **Tailwind CSS** and **shadcn/ui** for standard controls
* Hand-written TypeScript types mirroring the Pydantic schemas. No OpenAPI codegen.

React Flow is the most important frontend choice. It provides custom nodes, drag-to-connect (including `onConnectEnd` on empty canvas for branching), pan/zoom, selection, and positioning.

### Regional annotations

An SVG overlay inside the image node. Three rectangle kinds (like / dislike / note) with normalized coordinates. While drawing, disable node drag and canvas pan (React Flow's `nodrag` / `nopan` classes). See [regional-annotations.md](regional-annotations.md). No react-konva.

### Uploads and drag-and-drop

* Dropping an image file on the canvas posts it to an upload endpoint, which stores the file and creates an uploaded image node at the drop position.
* Dragging an image node into the chat composer uses HTML drag-and-drop with the node ID as payload; no file transfer is involved.

## Persistence

One SQLite file and one images directory (`data/images/`). No workspaces; the app has exactly one graph.

Tables:

| Table | Key fields |
|---|---|
| `concept_nodes` | id, title, body, status (draft / committed), compiled_prompt, position, timestamps |
| `image_nodes` | id, source (generated / uploaded), file_path, feedback, generation_id, position, timestamps |
| `edges` | id, source_node_id, target_concept_id (parents of a concept; a generated image's producing concept is implied by its generation) |
| `annotations` | id, image_node_id, kind, x, y, w, h, note |
| `chat_messages` | id, concept_id, role, content, attached_image_ids |
| `generations` | id, concept_id, prompt, model, quality, size, reference_image_ids, status, error, timestamps |

Images are files on disk; only paths and metadata go in SQLite. Never base64 in the database.

## Generation as a first-class entity

A generation row records everything needed to understand and reproduce a batch: the committed concept, the exact compiled prompt, the model and settings, the reference image IDs, status, and the resulting image nodes.

This preserves the invariant that all images attached to one committed concept are alternative outputs of the same frozen request. **Generate more** creates a new generation row with the same prompt and the same reference IDs copied from the concept's first generation. It never recompiles.

## Backend invariants

The backend owns these rules; the frontend just reflects them.

* Editing text or parents of a committed concept is rejected.
* Commit compiles the prompt once and stores it on the concept.
* Deleting a committed concept or a generated image is rejected. Deleting an uploaded image that a committed concept references is rejected.
* Edges into image nodes are rejected. Only committed concepts and image nodes can be parents, which keeps the graph acyclic without a cycle check.
* Chat attachments are passed to the refiner only. The image generator receives parent images exclusively from the frozen reference set.

## Long-running operations

Generation takes tens of seconds. Flow:

1. `POST /concepts/{id}/generate` commits the concept if it is a draft, creates a generation row with status `running`, and starts the work with FastAPI `BackgroundTasks` (in-process). Returns immediately.
2. The frontend polls `GET /generations/{id}` until status is `done` or `failed`, then refetches the graph.
3. Image nodes are placed automatically in a row under the concept.

No SSE, no WebSockets, no job queue.

## API

The full contract, with JSON shapes and error rules, is in [api.md](api.md). Both sides are hand-written against it.

## Configuration and mock mode

Settings come from `.env` (see `.env.example` at the repo root): the two API keys, model IDs, image quality/size, candidate count, and the data directory.

`MOCK_AI=true` (the default) makes the backend run without any external calls: refine returns canned concept text derived from the message, and generation writes placeholder PNGs after a short delay. Every UI flow works in mock mode, so the app can be built and demoed end to end before keys exist. Set it to `false` once both keys are filled in.

## Testing

A few pytest tests for the backend invariants above if time allows. No frontend test setup. Manual walkthrough of the demo script in [concept.md](concept.md) is the acceptance test.

## High-level architecture

React / React Flow, calling FastAPI, which holds the domain rules and calls OpenRouter via LangChain for text, the OpenAI image API for images, and SQLite plus the local images directory for storage.

## Deliberately avoid

* Alembic, OpenAPI codegen, Vitest, Playwright;
* LangGraph, Redis, Celery, vector databases, Kubernetes, microservices;
* SSE or WebSocket layers;
* storage abstractions, object storage, Postgres migration paths;
* authentication, multi-tenancy, observability platforms.

None of these are needed to demonstrate the central idea.
