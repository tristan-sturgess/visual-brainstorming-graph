# Tech Stack & Architecture

This document captures the proposed proof-of-concept stack and the main architectural decisions for the Visual Brainstorming Graph.

## Guiding principle

Keep the application architecture conventional and lightweight everywhere except the graph-based creative experience.

The proof of concept should optimize for:

* fast iteration;
* clear provenance for generated images;
* minimal infrastructure;
* easy replacement of fast-moving AI providers and models;
* a polished graph UI;
* avoiding infrastructure that does not directly prove the product idea.

## Core stack

### Backend

Use:

* **Python 3.12+**
* **Poetry** for dependency management
* **FastAPI** for the HTTP API
* **Pydantic** for request/response and domain schemas
* **SQLAlchemy** for persistence
* **Alembic** for schema migrations

FastAPI fits the application well because most backend behavior is conventional CRUD plus a small number of longer-running AI operations.

### LLM access

Use:

* **OpenRouter** as the model gateway
* **LangChain** for model abstraction, prompt/message handling, and structured output
* an OpenAI-compatible LangChain client pointed at OpenRouter where appropriate

For the first version, LangChain is sufficient. Do not introduce LangGraph unless the product later gains genuinely agentic or state-machine-like workflows.

The main LLM responsibilities are:

* turning rough user input into a structured concept;
* refining draft concepts through chat;
* incorporating parent concepts, image feedback, annotations, and temporary references;
* compiling a frozen human-readable concept into a model-facing image-generation prompt.

### Image generation

Use the **OpenAI image-generation API** directly through the official Python SDK, behind a small internal abstraction.

The image generation layer should support:

* text-to-image generation;
* image-reference / image-edit generation when one or more image nodes are connected;
* multiple candidate images from the same frozen generation request;
* configurable quality and dimensions;
* lower-cost / faster draft generation where useful;
* higher-quality generation as an optional later affordance.

The normal brainstorming flow should prefer a relatively fast, inexpensive quality setting. The exact model and quality level should be configuration rather than being hard-coded into the domain model.

### Frontend

Use:

* **React**
* **TypeScript**
* **Vite**
* **React Flow / @xyflow/react** for the graph canvas
* **Zustand** for lightweight local/editor state
* **TanStack Query** for backend/server state
* **Tailwind CSS**
* **shadcn/ui** or similar primitives for standard UI controls

React Flow is the most important frontend choice because the graph is the product's primary interaction model. It provides the foundation for:

* custom concept and image nodes;
* drag-to-connect interactions;
* pan and zoom;
* node selection;
* branching;
* multiple parent connections;
* graph layout and positioning.

### Regional annotations

Start with a lightweight overlay on top of images.

For the first proof of concept, annotations only need to support:

* selecting or marking a region;
* attaching a short text note describing what to preserve, change, or avoid.

A simple SVG/canvas overlay is sufficient initially. If annotation interactions become more sophisticated, a library such as **react-konva** can be introduced later.

## Persistence

### Database

Use **SQLite** for the proof of concept.

Persist structured application state such as:

* projects/workspaces;
* concept nodes;
* image nodes;
* graph edges;
* graph positions;
* generation batches;
* annotations;
* refinement messages;
* image-generation metadata.

Use SQLAlchemy so moving to Postgres later remains straightforward.

### Image storage

Do not store image data as base64 blobs in the database.

For local development:

* save image files to the local filesystem;
* store only paths and metadata in SQLite.

For a hosted demo, replace the filesystem adapter with object storage such as S3, Cloudflare R2, or equivalent.

The storage implementation should sit behind a small abstraction so this change does not affect graph/domain logic.

## Generation as a first-class entity

Image generation should be represented explicitly rather than treated as an incidental side effect of an image node.

A generation batch should record enough provenance to reproduce and understand what happened, including:

* committed concept ID;
* compiled model-facing prompt;
* image-generation model;
* quality setting;
* dimensions;
* connected visual-reference image IDs;
* other relevant generation parameters;
* generated image IDs;
* creation time and status.

This preserves the product invariant that images attached to one committed concept are alternative outputs from the same frozen creative request.

If the user selects **Generate more**, the system should reuse the same compiled prompt and frozen reference set rather than silently recompiling the concept.

## AI service boundaries

Keep external AI providers behind thin interfaces so product logic does not depend directly on a specific vendor.

Useful conceptual interfaces include:

### ConceptRefiner

Takes the current draft concept plus relevant reasoning context and returns an updated human-readable concept.

### PromptCompiler

Takes a committed concept and converts it into one clear model-facing image-generation prompt.

This step should preserve intent rather than introduce new creative directions.

### ImageGenerator

Takes:

* the frozen generation prompt;
* selected visual-reference images;
* generation settings;

and returns generated candidates plus provider metadata.

These interfaces make it easy to change OpenRouter models, swap image models, or test components independently.

## API boundary

Use FastAPI's OpenAPI schema as the contract between backend and frontend.

Generate or derive TypeScript API types/client code from the schema rather than manually maintaining duplicate models.

Important API concepts will likely include:

* graph/workspace;
* concept node;
* image node;
* edge;
* annotation;
* refinement session/message;
* generation batch.

## Long-running operations

Keep background execution simple initially.

Image generation and some LLM calls can take several seconds, so the API should not assume every interaction is instant.

A lightweight first version can:

1. create a generation record;
2. start the work asynchronously in-process;
3. expose generation status;
4. let the frontend poll or receive updates through Server-Sent Events.

Do **not** introduce Celery, Redis, or a separate distributed job system unless reliability or hosted concurrency makes one necessary.

## Testing and configuration

Use:

* **pytest** for backend tests;
* **Vitest** for frontend/unit tests;
* **Playwright** for a small number of end-to-end flows;
* **pydantic-settings** and environment variables for configuration and API keys.

The most valuable end-to-end test is the core product loop:

**create draft concept → refine → commit/generate → select/annotate image → branch → combine references → generate again**

## High-level architecture

The intended structure is:

**React / React Flow**

→ **FastAPI**

→ **domain/application services**

→ **OpenRouter + LangChain**

→ **OpenAI image generation**

→ **SQLite + image storage**

The backend should own domain rules such as draft/committed concept state and immutable generation provenance. The frontend should own interaction state and presentation but should not become the source of truth for those invariants.

## Deliberately avoid for the proof of concept

Do not add these unless a concrete need appears:

* LangGraph;
* Redis;
* Celery;
* vector databases;
* Kubernetes;
* microservices;
* a separate WebSocket infrastructure layer;
* production authentication/authorization;
* complex distributed storage;
* sophisticated observability platforms.

None of these are needed to demonstrate the central idea.

## Summary

The proof-of-concept stack is intentionally straightforward:

**Python + Poetry + FastAPI + SQLAlchemy/SQLite** on the backend.

**OpenRouter + LangChain** for LLM work.

**OpenAI image generation** behind a thin image-generation adapter.

**React + TypeScript + React Flow** for the frontend.

The architecture should stay modular enough that rapidly changing AI providers and models can be swapped without changing the core graph or creative-workflow domain model.
