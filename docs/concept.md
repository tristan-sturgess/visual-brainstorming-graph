# Visual Brainstorming Graph

## Goal

Build a visually impressive proof of concept for exploring AI-generated image ideas as a branching graph rather than a linear prompt history.

The motivating experience: you are generating concept art, you like one piece of one result, and you wonder what it would look like tweaked in some way. In a linear chat you lose the other directions you already found. Here, every direction stays on the canvas. A user can start from a rough idea, generate several visual directions, explore each independently, mark what they like or dislike, and later combine branches into a new generation.

The graph is not just a history view. It is the primary interface for composing context and references for future generations.

## Core workflow

1. The user creates a root concept node. It starts as an empty draft.
2. The user describes the idea in the chat panel. The LLM writes the concept: a short title and a few sentences of human-readable creative direction.
3. While the concept is a draft, the user can keep refining it through chat, edit the text directly, and add or remove parent connections.
4. The user clicks Generate.
5. The concept is committed: its text and parent connections become read-only.
6. The system compiles the frozen concept, together with the feedback and regional annotations on its connected parent images, into one model-facing image-generation prompt and stores it.
7. A fixed number of candidate images (a config value, default 4) are generated from that prompt and the connected parent images. Variation comes from the image model itself, not from different prompts.
8. Each generated image appears as its own image node under the concept that produced it.
9. The user adds feedback to image nodes: a free-text note and optional regional annotations (like / dislike / note rectangles).
10. The user branches from a concept or an image by dragging from its handle onto empty canvas. This creates a new draft concept with that node as its parent, pre-filled with the source concept's text. No LLM call happens until the user sends a chat message.
11. The user connects additional parents by dragging from other nodes onto the draft. How to combine them is expressed in chat, for example "use the lighting from this one with the character from that one."
12. Repeat.

**Generate more** on a committed concept reuses the stored prompt and the same reference images exactly. It never recompiles, even if feedback on the parent images has changed since. Changing intent means branching to a new concept.

## Node types

### Concept node

Represents a creative direction.

A concept node contains:

* a **title** and a short **body** (a few sentences) written for humans;
* connections to its parent nodes (concept nodes and/or image nodes);
* a status: **draft** or **committed**;
* once committed, the frozen model-facing generation prompt;
* a Generate action (draft) or Generate more action (committed).

There is no separate notes field and no separate prompt node. The concept text is the whole user-facing state of the idea. It should read as the current distilled intent, not as a transcript of how the user got there.

**Draft state**

* text can be edited directly or refined through chat;
* parent connections can be added or removed;
* image nodes can be dragged into the chat as temporary context;
* the node can be deleted.

**Committed state**

* entered the first time the user clicks Generate;
* text and parent connections are read-only;
* Generate more reuses the same frozen prompt and reference set;
* the node cannot be deleted;
* further changes happen by branching to a new draft concept.

### Image node

Represents one image on the canvas. There are two sources:

* **Generated**: produced by a committed concept. Its provenance links it to that concept and to the generation batch that produced it.
* **Uploaded**: dropped onto the canvas or added via an Upload button by the user. Screenshots, sketches, mood images, or earlier work. It has no producing concept.

Both kinds behave identically once on the canvas. An image node contains:

* the image file;
* a persistent free-text **feedback** field;
* zero or more **regional annotations** (see [regional-annotations.md](regional-annotations.md));
* a handle for connecting the image as a parent of a draft concept;
* provenance (generation batch and concept, or "uploaded").

Feedback and annotations belong to the image itself rather than to a single refinement step, so they carry forward wherever that image is reused.

### Edges

* A concept node's parents can be committed concept nodes and/or image nodes. Multiple parents are allowed. Drafts cannot be parents, which keeps the graph acyclic.
* A generated image node has exactly one incoming edge, from the concept that produced it. An uploaded image node has none.
* Users cannot create edges into image nodes.

### Deletion

Draft concepts can be deleted. Uploaded image nodes can be deleted while no committed concept references them. Committed concepts and generated images cannot be deleted. This keeps provenance intact without any extra rules.

## Graph interaction

The canvas supports pan/zoom and makes branching visually obvious.

Primary interactions:

* Drag from a node's handle onto empty canvas to create a new draft concept with that node as a parent.
* Drag from another existing node onto a draft concept to add an additional parent.
* Select a draft concept's parent edge and delete it to remove the parent.
* Drop an image file onto the canvas to create an uploaded image node.
* Drag an image node into the chat composer to attach it to the next message.

Multiple incoming edges mean multiple sources are available to the new concept. Connections do not carry merge semantics. They provide context and references; the user explains how to combine them in chat only if they care.

## Refinement chat

A chat panel on the right is shown when a draft concept is selected. There is one LLM operation, **refine**, used for the initial concept, later refinement, and multi-parent synthesis alike.

Each refine call receives:

* the current concept title and body (possibly empty);
* the text of connected parent concepts;
* connected parent images, with their feedback and regional annotations;
* the chat history for this draft;
* any image nodes attached to the current message;
* the user's message.

It returns an updated title and body plus a short assistant reply. The refiner model must be vision-capable, since it looks at images.

### Chat attachments

The user can drag any image node from the canvas into the chat composer. The image, its feedback, and its annotations become context for that message only. Attached images are **never** sent to the image model. This covers cases such as:

> "Look at this one. I don't like what happened to the face. Update the concept to avoid that, but don't use it as a visual reference."

This keeps two ideas distinct:

* **Graph parent connections** are reusable context and visual references for generation.
* **Chat attachments** are temporary reasoning context for the refiner only.

Since uploads become image nodes, there is no separate upload-to-chat path.

## Image-generation inputs

The user's primary abstraction is the concept, not the raw image-generation prompt.

When the user first clicks Generate:

1. The concept text and parent connections are frozen.
2. A text-only LLM step (the **prompt compiler**) converts the concept into one clear model-facing image-generation prompt. Its input is the frozen concept plus the feedback and annotations of directly connected parent images, serialized as text (for example "like, upper left: the character design"). It preserves the user's intent rather than reinterpreting it.
3. The compiled prompt is stored on the concept.
4. The image model receives the compiled prompt and the connected parent images as references. With one or more parent images this is an image-edit call; with none it is text-to-image.
5. The configured number of candidates is generated from that one request.

The image-edit path is the primary path. Most generations in a session have at least one parent image, because "tweak this image" is the core moment of the product.

The raw compiled prompt is available as an advanced/debug detail on the committed node, but users should not need to read or edit it.

The wider graph history is not sent to the image model. Grandparents, chat history, and attachments influence the concept text during refinement; the concept is the distilled state of the idea.

## Concept variation

One committed concept corresponds to one generation intent. If the user wants deliberately different interpretations of an idea, those are separate concept nodes. Automatic fan-out ("make three variations exploring different lighting") is out of scope.

## Scope for the proof of concept

The demo prioritizes the visual creative loop and polish on the graph.

### In scope

* interactive node canvas with pan/zoom;
* draft and committed concept nodes;
* generated and uploaded image nodes;
* multiple candidate images from one frozen generation request;
* Generate more;
* branching by dragging from a node;
* multiple parents;
* free-text feedback on image nodes;
* regional annotations (like / dislike / note rectangles);
* chat refinement of draft concepts, with image nodes draggable into the chat;
* one-time compilation of a concept into a stored generation prompt;
* image generation using connected parent images as references;
* local SQLite persistence.

### Out of scope

* authentication, multi-tenancy, teams, permissions;
* billing, subscriptions, credits, pricing pages;
* production rate limiting or cost controls;
* voice input (use the OS dictation feature into the chat box instead);
* autonomous agents that create, delete, or rewire the graph;
* automatic generation of concept variants;
* merge semantics or conflict resolution for contradictory parents;
* multiple workspaces or projects (one graph);
* hosting, object storage, or anything beyond one machine.

The user stays in explicit control of graph structure. AI refines content inside nodes; it does not drive the application.

## Demo script

The demo scenario is concept art for a personal website.

1. Create a root concept. In chat: "Hero illustration for my personal site. Isometric desk scene, warm palette, a bit playful." The LLM writes the concept. Generate.
2. Four candidates appear. On one, add feedback "Love the palette. The sleeping cat is perfect." and draw a like rectangle over the cat. On another, add "Great composition, but the background is too busy." and draw a dislike rectangle over the busy wall.
3. Drag the "+" under the first image onto empty canvas. The new draft is pre-filled. In chat: "Same scene, simpler background, keep the cat exactly as it is." Generate. The results keep the cat and palette and swap the wall for a plain one.
4. Live: drag the "+" under the best step 3 result onto empty canvas to branch, then drag the "+" under the second image onto the top of that draft to add it as a second parent. In chat: "Bring in this one's composition." Generate.
5. Optionally drop a screenshot of the current website onto the canvas, connect it, and say "match these brand colors."

Each Generate takes roughly a minute for four images, so steps 1 through 3 are built before the event and only step 4 runs live. Persistence makes this free. See [demo-runbook.md](demo-runbook.md) for the day-of checklist.

## Demo thesis

The compelling part is not image generation with a node UI. It is that creative exploration becomes a visible, reusable structure:

**generate, compare, annotate, branch, combine, refine, generate again**

Users preserve multiple promising directions instead of overwriting one prompt, and can later recombine those directions while keeping both the visual references and the notes about what worked in each one.
