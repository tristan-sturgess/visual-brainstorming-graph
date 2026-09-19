# Visual Brainstorming Graph

A branching visual brainstorming tool where AI-generated images become reusable ideas: explore alternatives, mark what works, and combine the best parts into new directions without losing your creative history.

Instead of a linear prompt history, ideas live on an interactive graph:

- **Concept nodes** hold a short human-readable creative direction. Write and refine them through chat while they're drafts; they freeze when you click Generate.
- **Image nodes** are the candidates a concept produces, or images you drop in yourself. Add text feedback and draw like / dislike / note rectangles to say what works and what doesn't.
- **Branch** from any concept or image by dragging onto empty canvas, **connect multiple parents** to combine branches, and drag image nodes into the chat to talk about them without using them as references.

**generate, compare, annotate, branch, combine, refine, generate again**

> Local-only proof of concept. One user, one machine, one graph. No auth, billing, or hosting.

## Docs

- [Concept](docs/concept.md): product concept, workflow, scope, and the demo script
- [Core Concepts & Mental Model](docs/core-concepts-and-mental-model.md): the short version to keep in your head
- [Regional Annotations](docs/regional-annotations.md): the three rectangle kinds and how they reach the models
- [Tech Stack & Architecture](docs/tech-stack-and-architecture.md): stack, data model, configuration
- [API Contract](docs/api.md): the HTTP contract both sides are written against
