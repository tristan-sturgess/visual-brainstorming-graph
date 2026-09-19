# Visual Brainstorming Graph

## Goal

Build a visually impressive proof-of-concept for exploring image ideas as a branching graph rather than a linear prompt history.

A user should be able to start from a rough idea, generate several visual directions, explore those directions independently, annotate what they like or dislike, and later combine multiple branches into a new generation.

The graph is not just a history view. It is the primary interface for composing context and references for future generations.

## Core workflow

 1. The user starts with a rough concept, typed or spoken.
 2. An LLM turns that input into a structured, human-readable concept.
 3. While the concept node is still a draft, the user can refine it through chat, edit it directly, and add or remove parent connections.
 4. The user clicks Generate.
 5. The concept node is committed: its concept text and parent connections become read-only.
 6. The system compiles the frozen concept into one model-facing image-generation prompt and stores it with the generation state.
 7. Several candidate images are generated from the same prompt and the same connected image references. The variation comes from the image model itself rather than from intentionally different prompts.
 8. Each generated image appears as its own image node connected to the concept that produced it.
 9. The user can add persistent feedback to individual image nodes, such as:
    * "I like the character design."
    * "Keep the lighting, but not the composition."
    * "The background is too busy."
10. The user can branch from an existing concept or image to create a new draft concept node.
11. A concept node can accept multiple parents, allowing separate branches to be combined.
12. The LLM synthesizes a new concept from the available parent context and any user refinement instructions.
13. The user repeats the loop.

A committed concept can generate additional images later, but those images should reuse the same frozen generation prompt and reference set. Changing the concept or its parents requires creating a new concept node.

## Node types

### Concept node

Represents the current creative direction.

A concept node contains:

* a human-readable structured concept;
* optional user instructions or notes;
* references to its parent nodes;
* a Generate action that produces candidate image nodes;
* once committed, the frozen model-facing generation prompt used for generation.

A concept node has two phases:

**Draft**

* concept text can be edited or refined through chat;
* parent connections can be added or removed;
* no generation history is yet attached to that exact state.

**Committed**

* created the first time the user clicks Generate;
* concept text and parent connections become read-only;
* future Generate actions reuse the same frozen generation intent;
* further changes happen by branching to a new concept node.

Creating a child concept is the primary refinement mechanism after a concept has been committed. A separate "prompt refinement" node type is not necessary for the proof of concept.

The concept should represent the current distilled creative intent, not an ever-growing transcript of how the user arrived there.

### Image node

Represents one generated candidate image.

An image node contains:

* the generated image;
* a persistent feedback / annotation field;
* a connection affordance for using the image as a parent in a future concept;
* provenance linking it to the committed concept and generation request that produced it.

Feedback belongs to the image itself rather than to a single refinement step so that the feedback remains useful if the same image is reused later.

## Graph interaction

The canvas should support pan/zoom and make branching visually obvious.

Primary connection interaction:

* Drag from a node's + / output affordance onto empty space to create a new draft concept node with that node as a parent.
* Drag from another existing node onto that concept node to add an additional parent.
* Multiple incoming edges represent multiple sources being made available to the new concept.

The graph should make it easy to visually understand how a final result emerged from earlier experiments.

Connections do not need complex merge semantics. They provide context and references; the user can add refinement instructions if they want more control, but the system should not require them to formally explain how every parent should be combined.

## Refinement chat

A familiar chat/refinement panel can live on the right side when a draft concept node is selected.

The user can describe changes conversationally rather than manually writing a production-quality image prompt. The LLM updates the concept node's human-readable concept.

The refinement model can use:

* parent concept text;
* connected images;
* persistent feedback stored on those images;
* regional annotations;
* the user's current refinement instruction;
* temporary chat attachments.

Images can also be attached to the refinement conversation as temporary reasoning context without necessarily becoming graph parents. This covers cases such as:

> "Look at this image. I don't like what happened to the face. Update the concept to avoid that, but don't use this image as a visual reference in the next generation."

This keeps two ideas distinct:

* **Graph parent connections** represent reusable context and generation references.
* **Chat attachments** can be temporary context used only to reason about or refine the concept.

## Image-generation inputs

The user's primary abstraction is the concept, not the raw image-generation prompt.

When the user first clicks Generate:

1. The concept and parent connections are frozen.
2. A lightweight LLM step converts the human-readable concept into one clear model-facing image-generation prompt.
3. That compilation step should preserve the user's intent rather than creatively reinterpret it.
4. The compiled prompt is stored so subsequent generations from the same committed concept can reuse it exactly.
5. The image model receives:
   * the compiled generation prompt;
   * any image nodes intentionally connected as visual-reference parents.
6. Multiple candidate images are generated from that same request.

The raw model-facing prompt can be available as an advanced/debug detail, but users should not need to see or edit it in the normal workflow.

The broader graph history does not need to be sent directly to the image model. Parent history, feedback, and annotations are used while refining the concept; the concept acts as the distilled textual state of the idea.

## Concept variation

For the proof of concept, one committed concept corresponds to one generation intent.

If the user wants deliberately different interpretations of an idea, that should be represented as different concept nodes rather than silently generating different prompts behind a single concept.

A future agentic workflow could support requests such as:

> "Create three variations of this concept, each exploring a different lighting direction."

The system could create several child concept nodes automatically. Autonomous concept diversification like this is deliberately out of scope for the first version.

## Voice input

For the initial concept, support voice input if time allows.

The intended flow is:

**rough voice dump → transcription → LLM-refined concept → user review/edit → image generation**

Voice is an input convenience, not a separate agentic workflow.

## Scope for the proof of concept

The demo should prioritize the visual creative loop and polish around the graph.

### In scope

* interactive node canvas;
* draft and committed concept nodes;
* image nodes;
* multiple generated candidate images from one frozen generation intent;
* branching;
* multiple parents / branch recombination;
* persistent feedback on image nodes;
* regional annotations;
* LLM-assisted concept refinement;
* image generation using selected parent images;
* one-time compilation of a concept into a stored model-facing generation prompt;
* simple refinement chat;
* voice-to-concept input if practical;
* local/simple persistence;
* a static pricing page for product-demo polish.

### Deliberately out of scope

* authentication;
* multi-tenancy;
* teams and permissions;
* subscriptions;
* Stripe;
* credits / per-user usage accounting;
* production-grade rate limiting or cost controls;
* autonomous agents that freely create, delete, or rewire the graph;
* agentic generation of multiple concept variants;
* sophisticated conflict-resolution semantics for contradictory parents.

The first version should keep the user explicitly in control of graph structure. AI can refine content inside the workflow without becoming a general-purpose agent controlling the whole application.

## Demo thesis

The compelling part of the product is not simply image generation with a node UI.

The core idea is that creative exploration becomes a visible, reusable structure:

**generate → compare → annotate → branch → combine → refine → generate again**

Users can preserve multiple promising directions instead of overwriting a single prompt, and can later recombine those directions while retaining both the visual references and the reasoning about what worked in each one.
