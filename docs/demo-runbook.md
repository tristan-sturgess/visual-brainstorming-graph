# Demo Runbook

Day-of checklist for presenting the Visual Brainstorming Graph. The graph for steps 1 through 3 of the [demo script](concept.md#demo-script) is already built and persisted under `data/`.

## Before the demo

1. Check `.env`: both keys filled in, `MOCK_AI=false`. If the venue network is unreliable, flip `MOCK_AI=true` and restart the backend; the whole UI still works with placeholder images.
2. Start the backend, from the repo root:

   ```bash
   cd backend && poetry run uvicorn app.main:app --port 8000
   ```

3. Start the frontend:

   ```bash
   cd frontend && npm run dev
   ```

4. Open http://localhost:5173, press Fit View (the third button in the bottom-left controls), and confirm the pre-built graph is there: one committed root concept, four candidates, two of them annotated, one committed branch with four more candidates.
5. Zoom the browser so node text is readable on the projector. The canvas is easiest to narrate at around 75 to 100 percent zoom with the root concept near the top.

## Live sequence (about four minutes)

1. Click the root concept. Read the concept text aloud: this is what the user typed in one sentence and the LLM wrote up. Open "Compiled prompt" to show what actually went to the image model, then close it.
2. Click the annotated candidates. Show the like box on the cat and the dislike box on the busy wall, and the feedback text in the panel.
3. Click the branch concept. Point out it was created by dragging "+" from the first image, that the chat message was one sentence, and that the four results kept the cat and palette and simplified the wall.
4. **Live generation.** Drag the "+" under the best branch result onto empty canvas. A pre-filled draft appears. Drag the "+" under the busy-wall candidate onto the top of that draft: a second parent edge appears. In chat type "Bring in this one's composition." and press Enter, then click Generate. Narrate while it runs (about a minute): the concept is frozen, the prompt is compiled once, both parent images go to the image model as references, the dislike box on the wall is folded into the prompt.
5. While waiting, drag any image node into the chat composer to show attachments as reasoning-only context, then remove the chip.
6. When the four images land, click one, add a line of feedback, and say "and this is where the next branch would start."

## If something goes wrong

- **Generation fails or hangs.** The node shows the error. Click Generate more on the committed branch instead; it reuses the stored prompt. If the API is down, restart the backend with `MOCK_AI=true`.
- **Wrong drop.** Dropping "+" on a node body does nothing; drop on empty canvas to branch, on the top edge of a draft card to connect.
- **Stray draft.** Select it and press Delete, or use the Delete button in the panel. Committed nodes cannot be deleted.
- **Start over.** Stop the backend, delete `data/`, restart. The canvas is empty; rebuilding steps 1 through 3 takes about three minutes of wall time.

## Settings that matter

In `.env`: `IMAGE_MODEL=gpt-image-2.5-sunburst` for quality, `gpt-image-2.5-flare` for speed; `IMAGE_QUALITY=low` is plenty for a projector and is what the pre-built graph used; `CANDIDATE_COUNT=4`. Changing any of these needs a backend restart.
