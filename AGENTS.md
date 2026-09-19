# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

Visual Brainstorming Graph is a tool for exploring AI-generated image ideas as a branching graph instead of a linear prompt history. Users describe a concept in chat, generate candidate images, mark what works with text feedback and regional annotations, branch from any image or concept, and combine branches into new concepts. They can also drop in their own images as nodes.

Read [docs/concept.md](docs/concept.md) and [docs/core-concepts-and-mental-model.md](docs/core-concepts-and-mental-model.md) before making non-trivial changes. [docs/concept.md](docs/concept.md) ends with the demo script the build is judged against.

## This is a proof of concept

- **Local only.** Single user, one machine, one graph.
- **Speed over polish, except for the graph.** Get the core loop working quickly. Spend polish on the graph canvas and generation loop, since those are what the demo needs to prove.
- **Keep it simple.** Pick the most direct implementation. Don't add abstractions, config, or infrastructure the POC doesn't need yet.
- **Out of scope:** authentication, multi-tenancy, teams/permissions, billing/credits/pricing pages, production rate limiting, voice input, autonomous agents that edit the graph, automatic concept-variant generation, multiple workspaces, hosting. Don't build these unless asked.
- **Deliberately avoid:** Alembic, OpenAPI codegen, Vitest, Playwright, SSE/WebSockets, LangGraph, Redis, Celery, vector DBs, microservices, storage abstractions. See [docs/tech-stack-and-architecture.md](docs/tech-stack-and-architecture.md).

## Core invariants

These are the domain rules the code has to respect. The backend enforces them.

- **Concept nodes have two states: draft and committed.** Drafts are editable (title, body, parent connections) and deletable. The first Generate commits the concept; after that its text and parents are read-only and it cannot be deleted.
- **One committed concept = one frozen generation intent.** On commit, the concept plus the feedback and annotations on its connected parent images are compiled once into a model-facing prompt and stored. "Generate more" reuses that exact prompt and reference set. It never recompiles.
- **Changing intent means a new node.** Branching creates a draft pre-filled with the source concept's text. No LLM call until the user sends a chat message.
- **One LLM operation for concept text: refine.** It writes the initial concept, refines it, and synthesizes multi-parent concepts. It is vision-capable.
- **Graph parents vs chat attachments.** Connected parent images are visual references for generation. Image nodes dragged into the chat are temporary reasoning context for the refiner only and are never sent to the image model.
- **Image nodes come from generation or upload** and behave identically afterwards. A generated image's only incoming edge is from its producing concept; an uploaded image has none. Nobody creates edges into image nodes.
- **Feedback and annotations belong to the image node,** not to a single refinement step, so they carry forward wherever that image is reused. Annotations are like / dislike / note rectangles with normalized coordinates.
- **The backend owns these rules.** The frontend handles interaction and presentation but is not the source of truth for concept state or generation provenance.

## Stack

Backend: Python 3.12+, Poetry, FastAPI, Pydantic, SQLAlchemy + SQLite (`create_all`, no migrations), pydantic-settings. LLM calls go through OpenRouter via LangChain. Image generation uses the OpenAI image API (edit endpoint when parent images exist) behind one small module. Generation runs in-process with FastAPI BackgroundTasks; the frontend polls.

Frontend: React, TypeScript, Vite, React Flow (`@xyflow/react`), Zustand, TanStack Query, Tailwind, shadcn/ui. Hand-written API types.

Images are stored under `data/images/`, with only paths and metadata in SQLite. Full details are in [docs/tech-stack-and-architecture.md](docs/tech-stack-and-architecture.md).

## Keep docs in sync

The `docs/` folder is the source of truth for the product concept and architecture. **Whenever a code change affects behavior, scope, data model, architecture, or stack choices, update the relevant doc in the same change.** If the code deliberately diverges from a doc, update the doc to match reality instead of leaving it stale. Keep `README.md` and this file current too.
