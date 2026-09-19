// Chooses which panel to show for the current selection, or a hint when
// nothing is selected.
import { useEditorStore } from "../store";
import type { Graph } from "../api/types";
import { ConceptPanel } from "./ConceptPanel";
import { ImagePanel } from "./ImagePanel";

export function RightPanel({ graph }: { graph: Graph }) {
  const selectedNode = useEditorStore((s) => s.selectedNode);

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm text-gray-400">
        <p>Select a concept or image node to see its details here.</p>
        <p className="text-xs">
          Drag the + onto empty canvas to branch, or onto a concept to add it as a parent.
        </p>
      </div>
    );
  }

  if (selectedNode.type === "concept") {
    const concept = graph.concepts.find((c) => c.id === selectedNode.id);
    if (!concept) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
          This concept no longer exists.
        </div>
      );
    }
    return <ConceptPanel concept={concept} />;
  }

  const image = graph.images.find((i) => i.id === selectedNode.id);
  if (!image) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
        This image no longer exists.
      </div>
    );
  }
  const producingConcept = image.concept_id
    ? graph.concepts.find((c) => c.id === image.concept_id)
    : undefined;
  return <ImagePanel image={image} producingConcept={producingConcept} />;
}
