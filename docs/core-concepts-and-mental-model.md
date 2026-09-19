# Core Concepts & Mental Model

This document captures the simplest mental model for the product so that the graph, UI, and implementation all reinforce the same ideas.

## The user-facing model

**Concept node = what I want.**

A concept node is the current distilled creative direction. It should be readable and editable by a person. Users should not need to write production-quality image prompts.

**Connected image = what I want the model to visually reference.**

Connecting an image to a draft concept makes that image available as a visual reference for future generation. Feedback and annotations on the image can also help the LLM refine the concept.

**Generation prompt = hidden adapter between the concept and the image model.**

When a concept is first generated, the system compiles the human-readable concept into one model-facing image prompt. This is an implementation detail rather than the main user interface.

**Multiple generated images = different stochastic interpretations of the same request.**

A committed concept uses one frozen generation prompt and one frozen set of visual references. Multiple candidate images are generated from that same request.

**New concept node = a meaningful change in creative intent.**

If the user wants to change the concept, change its parents, or deliberately explore a different interpretation, that becomes a new node rather than silently mutating the history.

## Concept lifecycle

A concept has two states.

### Draft

A draft concept is a workspace for thinking.

The user can:

* refine it through chat;
* edit the concept directly;
* add or remove parent connections;
* attach temporary reasoning context;
* decide what the next generation should represent.

### Committed

The first Generate action commits the concept.

At that point:

* the concept text is frozen;
* the parent connections are frozen;
* the model-facing generation prompt is compiled and stored;
* generated images are attached to that exact state.

The user can generate more images from a committed concept, but those generations reuse the same frozen intent. To change anything meaningful, branch to a new concept.

## What the graph means

The graph is a record of creative reasoning, not just a history of API calls.

Branches let the user preserve competing ideas instead of overwriting them.

Multiple parents mean:

> "Use these earlier ideas or references as context for this new direction."

They do not imply a rigid merge algorithm. The user can explain how to combine them if they care, but the system should still be able to attempt a synthesis without requiring extra instructions.

## Context versus generation references

There are two intentionally different ways an image can be used.

**Graph-connected image**

* persists as part of the graph;
* becomes an explicit visual reference for generation;
* carries its feedback and annotations forward as useful reasoning context.

**Temporary chat attachment**

* is available to the LLM while refining the concept;
* does not automatically become a visual reference for the next image generation.

This distinction lets the user say, in effect:

> "Learn from this image, but do not copy from it."

## The concept is the compression layer

The full ancestry of the graph can become large.

The current concept should therefore act as a distilled summary of the creative intent that matters now. Parent concepts, images, annotations, and chat history can influence refinement, but the image model does not need the entire graph history.

This keeps the user-facing concept understandable and prevents prompt context from growing without bound.

## One concept, one intent

For the first version, a committed concept should not secretly fan out into several deliberately different prompts.

If the user wants three intentional variations of a concept, those should eventually become three visible child concept nodes.

That preserves a simple invariant:

> If two images came from the same committed concept, they are alternative generations of the same creative request.

A future agent can automate the creation of concept variants, but that is a layer on top of the core model rather than part of generation itself.

## Product principle

The system should ask the user for as little formal specification as possible.

The user expresses intent by:

* writing or speaking about what they want;
* choosing which images or concepts to connect;
* annotating what worked or did not;
* branching when they want to explore a different direction.

The AI should turn that lightweight input into useful generation context without forcing the user to manage low-level prompt engineering or graph semantics.
