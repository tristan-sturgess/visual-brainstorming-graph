# Demo Runbook

Day-of checklist for presenting the Visual Brainstorming Graph. The graph for steps 1 through 5 of the [demo script](concept.md#demo-script) is already built and persisted under `data/`: the wizard-versus-dragon scene.

A recorded walkthrough of this graph, ending with a live branch-and-generate step, is in [demo-wizard-dragon.mp4](demo-wizard-dragon.mp4). The earlier isometric-desk flow is in [demo.mp4](demo.mp4).

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

4. Open http://localhost:5173, press Fit View (the third button in the bottom-left controls), and confirm the pre-built graph is there: the root concept "Wizard vs Dragon at Dusk" with four candidates at the top, three columns below it (wizard on the left, dragon in the middle, environment on the right) of two committed concepts each, and "Final: Wizard vs Dragon" at the bottom with three parent edges and four candidates. Eight concepts, 32 images, 24 annotations.
5. Zoom the browser so node text is readable on the projector. The graph is wide; narrate it column by column at around 50 percent zoom, then zoom in on individual images.

## Live sequence (about four minutes)

1. Click the root concept. Read the concept text aloud: this is what the user typed in one sentence and the LLM wrote up. Open "Compiled prompt" to show what actually went to the image model, then close it.
2. Click the three annotated root candidates. Show the like box on the wizard and the dislike box on the castle, the like box on the dragon with the note about the bolt, and the like box on the gorge with the dislike on the tiny wizard. Each one seeded a branch.
3. Walk one column top to bottom, the wizard column is the most visual: the branch concept was created by dragging "+" from the annotated root image, the chat message was one sentence ("Focus on the wizard..."), the best result got a note on the staff, the step-two concept asked for a scar and a rune-carved staff, and the locked result at the bottom has the like boxes on the face and the staff.
4. Click "Final: Wizard vs Dragon". Point out the three parent edges from three different columns, then open "Compiled prompt": the like, dislike and note annotations from all three locked images are folded into the prompt, and all three images went to the image model as references. Click the final candidate with feedback.
5. **Live generation.** Drag the "+" under that final image onto empty canvas. A pre-filled draft appears. Drag any other image node into the chat composer to show attachments as reasoning-only context, then remove the chip. In chat type one change (for example "Make it night, with the moon behind the dragon.") and press Enter, then click Generate. Narrate while it runs (30 to 60 seconds): the concept is frozen, the prompt is compiled once, the parent image goes to the image model as a reference, and the annotations on it are carried along.
6. When the four images land, click one, add a line of feedback, and say "and this is where the next branch would start."

## If something goes wrong

- **Generation fails or hangs.** The node shows the error. Click Generate more on any committed concept instead; it reuses the stored prompt. If the API is down, restart the backend with `MOCK_AI=true`.
- **Wrong drop.** Dropping "+" on an image or committed concept does nothing (only drafts accept parents, and they highlight while you drag); drop on empty canvas to branch, anywhere on a draft card to connect.
- **Stray draft.** Select it and press Delete, or use the Delete button in the panel. Committed nodes cannot be deleted.
- **Restore the pre-built graph.** Stop the backend, copy `data/backup-wizard-dragon-graph/app.db` over `data/app.db` and its `images/` folder over `data/images/`, restart. The earlier isometric-desk graph is kept the same way under `data/backup-isometric-desk-graph/`; each backup folder has a README with the exact commands.
- **Start over.** Stop the backend, delete `data/`, restart. The canvas is empty; rebuilding steps 1 through 5 takes about ten minutes of wall time.

## Settings that matter

In `.env`: `IMAGE_MODEL=gpt-image-2.5-sunburst` for quality, `gpt-image-2.5-flare` for speed; `IMAGE_QUALITY=high` is what the pre-built graph used (about 30 to 60 seconds per Generate), `low` is faster if the live step drags; `CANDIDATE_COUNT=4`. Changing any of these needs a backend restart.
