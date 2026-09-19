# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

Visual Brainstorming Graph is a tool for exploring AI-generated image ideas as a branching graph instead of a linear prompt history. Users create concepts, generate candidate images, annotate what works, branch, and combine branches into new concepts.

Read [docs/concept.md](docs/concept.md) and [docs/core-concepts-and-mental-model.md](docs/core-concepts-and-mental-model.md) before making non-trivial changes.

## This is a proof of concept

- **Local only.** Single user, running on one machine.
- **Speed over polish, except for the graph.** Get the core loop working quickly. Spend polish on the graph canvas and generation loop, since those are what the demo needs to prove.
- **Keep it simple.** Pick the most direct implementation. Don't add abstractions, config, or infrastructure the POC doesn't need yet.
- **Out of scope:** authentication, multi-tenancy, teams/permissions, billing/Stripe/credits, production rate limiting, autonomous agents that edit the graph, and agentic concept-variant generation. Don't build these unless asked.
- **Deliberately avoid:** LangGraph, Redis, Celery, vector DBs, microservices, separate WebSocket infra, Kubernetes. See [docs/tech-stack-and-architecture.md](docs/tech-stack-and-architecture.md).

## Core invariants

These are the domain rules the code has to respect:

- **Concept nodes have two states: draft and committed.** Drafts are editable (text and parent connections). The first Generate commits the concept, and after that its text and parents are read-only.
- **One committed concept = one frozen generation intent.** On commit, the concept is compiled once into a model-facing prompt and stored. "Generate more" reuses that exact prompt and reference set. It never recompiles.
- **Changing intent means a new node.** Edits to a committed concept happen by branching to a new draft concept.
- **Graph parents vs chat attachments.** Connected parent images are visual references for generation. Chat attachments are temporary reasoning context only and are never sent to the image model.
- **Feedback and annotations belong to the image node,** not to a single refinement step, so they carry forward wherever that image is reused.
- **The backend owns these rules.** The frontend handles interaction and presentation but is not the source of truth for concept state or generation provenance.

## Stack

Backend: Python 3.12+, Poetry, FastAPI, Pydantic, SQLAlchemy + SQLite, Alembic. LLM calls go through OpenRouter via LangChain. Image generation uses the OpenAI SDK behind a thin adapter.

Frontend: React, TypeScript, Vite, React Flow (`@xyflow/react`), Zustand, TanStack Query, Tailwind, shadcn/ui.

Images are stored on the local filesystem, with only paths and metadata in SQLite. Full details are in [docs/tech-stack-and-architecture.md](docs/tech-stack-and-architecture.md).

## Keep docs in sync

The `docs/` folder is the source of truth for the product concept and architecture. **Whenever a code change affects behavior, scope, data model, architecture, or stack choices, update the relevant doc in the same change.** If the code deliberately diverges from a doc, update the doc to match reality instead of leaving it stale. Keep `README.md` and this file current too.
