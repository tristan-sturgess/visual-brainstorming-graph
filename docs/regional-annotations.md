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

* Hover an image node to reveal an annotation toolbar with the three kinds.
* Pick a kind, then drag a rectangle on the image. While drawing, canvas panning and node dragging are suppressed.
* A small popover lets the user type the note (or skip it for like/dislike).
* Rectangles render as a colored SVG overlay on the image node, tinted by kind (green / red / neutral). Clicking one shows its note and a delete button.

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
