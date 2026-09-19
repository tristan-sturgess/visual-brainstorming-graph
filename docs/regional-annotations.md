# Regional Annotations

Regional annotations let the user say *which part* of an image they are reacting to, not just whether they like the image overall. They are the visual counterpart of the free-text feedback field on an image node.

## The three kinds

Each annotation is a rectangle drawn on the image with one of three kinds:

| Kind | Meaning | Note text |
|---|---|---|
| **like** | Keep or reuse what is in this region. | optional |
| **dislike** | Change or avoid what is in this region. | optional |
| **note** | Neutral observation or instruction about this region. | required |

Examples: a like box over a character ("this character design"), a dislike box over a background ("too busy"), a note box over a lamp ("this should be the main light source").

## Interaction

* Hover an image node to reveal an annotation toolbar with the three kinds. Picking a kind puts the node into annotation mode for that kind; clicking the active kind again, or pressing Escape, exits it.
* While in annotation mode, drag a rectangle on the image. Canvas panning and node dragging are suppressed for the duration of the drag. Rectangles smaller than 2% of the image in either dimension are discarded.
* On release, **like** and **dislike** rectangles are saved immediately with an empty note. A **note** rectangle instead opens a small inline text input anchored at the rectangle (autofocus; Enter submits, Escape cancels); an empty note is not submitted, since the backend rejects it.
* Rectangles render as percentage-positioned, colored overlays on the image node, tinted by kind (green / red / slate). On the canvas they are purely visual and never intercept pointer events, so the node can always be dragged, even from directly on top of a rectangle. Deleting an annotation (and seeing its note) happens from the image panel on the right, which lists each annotation with a Delete button.

Rectangles only. No freehand, polygons, or masks.

## Storage

Annotations belong to the image node. Each one stores:

* `kind`: like / dislike / note;
* `x`, `y`, `w`, `h`: normalized to the image (0 to 1), so they are independent of display size;
* `note`: text, may be empty for like/dislike.

## How annotations reach the models

Annotations are serialized to text with a coarse location derived from the rectangle, using a 3x3 grid (top left, top center, ..., center, ..., bottom right), for example:

```
Parent image B (feedback: "great composition, background too busy")
  - like, center: "the desk"
  - dislike, top left and top center: "too busy"
```

This text is given to:

* the **refiner**, along with the image itself, whenever the image is a connected parent or a chat attachment;
* the **prompt compiler**, for images connected as parents at the moment the concept is committed.

The image model never receives annotation geometry. It receives the compiled prompt and the parent images.

## Out of scope

* masks or inpainting;
* cropping regions out for the LLM (the full image plus the text description is enough);
* annotations on anything other than image nodes.
