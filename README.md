# Visual Brainstorming Graph

A branching visual brainstorming tool where AI-generated images become reusable ideas: explore alternatives, mark what works, and combine the best parts into new directions without losing your creative history.

Instead of a linear prompt history, ideas live on an interactive graph:

- **Concept nodes** hold a short human-readable creative direction. Write and refine them through chat while they're drafts; they freeze when you click Generate.
- **Image nodes** are the candidates a concept produces, or images you drop in yourself. Add text feedback and draw like / dislike / note rectangles to say what works and what doesn't.
- **Branch** from any concept or image by dragging onto empty canvas, **connect multiple parents** to combine branches, and drag image nodes into the chat to talk about them without using them as references.

**generate, compare, annotate, branch, combine, refine, generate again**

> Local-only proof of concept. One user, one machine, one graph. No auth, billing, or hosting.

## Running it

Prerequisites: Python 3.12+, Poetry, Node 22+.

```bash
cp .env.example .env    # then fill in OPENROUTER_API_KEY and OPENAI_API_KEY, or leave MOCK_AI=true
```

```bash
cd backend && poetry install && poetry run uvicorn app.main:app --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. The SQLite database and generated images live under `data/`; delete that folder to start from an empty canvas. With `MOCK_AI=true` the app runs fully offline with placeholder images.

## Docs

- [Concept](docs/concept.md): product concept, workflow, scope, and the demo script
- [Core Concepts & Mental Model](docs/core-concepts-and-mental-model.md): the short version to keep in your head
- [Regional Annotations](docs/regional-annotations.md): the three rectangle kinds and how they reach the models
- [Tech Stack & Architecture](docs/tech-stack-and-architecture.md): stack, data model, configuration
- [API Contract](docs/api.md): the HTTP contract both sides are written against
