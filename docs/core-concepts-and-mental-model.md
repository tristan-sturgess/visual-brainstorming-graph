# Core Concepts & Mental Model

This document captures the simplest mental model for the product so that the graph, UI, and implementation all reinforce the same ideas. [concept.md](concept.md) is the detailed spec; this is the summary to keep in your head.

## The user-facing model

**Concept node = what I want.**

A concept node is the current distilled creative direction: a title and a few sentences a person can read and edit. Users never write production-quality image prompts.

**Connected image = what I want the model to visually reference.**

Connecting an image to a draft concept makes that image a visual reference for generation. The image's feedback and regional annotations also inform both the chat refiner and the one-time prompt compilation.

**Uploaded image = my own reference, on the same footing as a generated one.**

The user can drop their own images onto the canvas. They become image nodes and behave like generated ones: connect them, annotate them, drag them into chat.

**Generation prompt = hidden adapter between the concept and the image model.**

When a concept is first generated, the system compiles the concept, plus the notes on its connected parent images, into one model-facing prompt. This is an implementation detail, visible only as a debug detail.

**Multiple generated images = different stochastic interpretations of the same request.**

A committed concept uses one frozen prompt and one frozen set of visual references. Every candidate, including those from Generate more, comes from that same request.

**New concept node = a meaningful change in creative intent.**

To change the concept, its parents, or the interpretation, branch to a new node. History is never mutated.

## Concept lifecycle

A concept has two states.

### Draft

A draft concept is a workspace for thinking. The user can:

* refine it through chat (the first chat message writes the concept from scratch);
* edit the text directly;
* add or remove parent connections;
* drag image nodes into the chat as temporary context;
* delete it.

Branching from a node creates a draft pre-filled with the source concept's text. No LLM call happens until the user speaks.

### Committed

The first Generate commits the concept. At that point:

* the text is frozen;
* the parent connections are frozen;
* the generation prompt is compiled once and stored;
* generated images attach to that exact state;
* the node can no longer be deleted.

Generate more reuses the frozen prompt and references. To change anything meaningful, branch.

## What the graph means

The graph is a record of creative reasoning, not just a history of API calls.

Branches let the user preserve competing ideas instead of overwriting them.

Multiple parents mean:

> "Use these earlier ideas or references as context for this new direction."

They do not imply a merge algorithm. The user can say how to combine them in chat, but the system attempts a synthesis without being told.

## Context versus generation references

There are two intentionally different ways an image can be used.

**Graph-connected image**

* persists as part of the graph;
* is an explicit visual reference for generation;
* carries its feedback and annotations into refinement and prompt compilation.

**Chat attachment (an image node dragged into the chat)**

* is available to the refiner for that message;
* is never sent to the image model.

This lets the user say, in effect:

> "Learn from this image, but do not copy from it."

## The concept is the compression layer

The full ancestry of the graph can become large. The concept text is the distilled summary of the intent that matters now.

What each model sees:

* **Refiner**: the draft, its direct parents (text, images, feedback, annotations), the draft's chat history, and any attachments.
* **Prompt compiler**: the frozen concept and the feedback and annotations of its direct parent images. Text only.
* **Image model**: the compiled prompt and the direct parent images. Nothing else.

Grandparents and older chat history reach the image model only through the words that ended up in the concept.

## One concept, one intent

A committed concept never fans out into several deliberately different prompts. If the user wants three intentional variations, those are three visible child concepts, created by the user.

> If two images came from the same committed concept, they are alternative generations of the same creative request.

## Product principle

The system asks for as little formal specification as possible. The user expresses intent by:

* writing about what they want;
* choosing which images or concepts to connect;
* marking what worked or did not, in text or by drawing a box;
* branching when they want to explore a different direction.

The AI turns that lightweight input into useful generation context without making the user manage prompt engineering or graph semantics.
