// Editor state that does not belong on the server: current selection, the
// in-flight generation per concept (drives polling), and chat composer state.
//
// Extension point: `attachedImageIds` is keyed by concept id so the next
// slice (drag an image node into the chat composer) can push ids into it by
// drag-and-drop without touching anything else in this store.
import { create } from "zustand";

type SelectedNode =
  | { type: "concept"; id: string }
  | { type: "image"; id: string }
  | null;

type EditorState = {
  selectedNode: SelectedNode;
  selectNode: (node: SelectedNode) => void;

  // conceptId -> generationId currently running, so nodes/panels know to poll.
  runningGenerationByConcept: Record<string, string>;
  setRunningGeneration: (conceptId: string, generationId: string | null) => void;

  // conceptId -> image node ids attached to the next chat message for that
  // concept's composer. Populated by drag-and-drop in the next slice.
  attachedImageIds: Record<string, string[]>;
  setAttachedImageIds: (conceptId: string, ids: string[]) => void;

  // A single ephemeral error/status message shown at the bottom of the
  // screen, e.g. for a rejected connection or a failed mutation.
  toast: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  selectedNode: null,
  selectNode: (node) => set({ selectedNode: node }),

  runningGenerationByConcept: {},
  setRunningGeneration: (conceptId, generationId) =>
    set((state) => {
      const next = { ...state.runningGenerationByConcept };
      if (generationId) {
        next[conceptId] = generationId;
      } else {
        delete next[conceptId];
      }
      return { runningGenerationByConcept: next };
    }),

  attachedImageIds: {},
  setAttachedImageIds: (conceptId, ids) =>
    set((state) => ({
      attachedImageIds: { ...state.attachedImageIds, [conceptId]: ids },
    })),

  toast: null,
  showToast: (message) => set({ toast: message }),
  clearToast: () => set({ toast: null }),
}));
