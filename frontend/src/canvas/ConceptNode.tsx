// Concept card. Target handle on top accepts parent connections; source
// handle on bottom is dragged out to branch or to connect this node as a
// parent of another draft. The backend enforces which connections are legal
// (e.g. a draft cannot be a parent) -- this node does not pre-filter that.
import { useEffect } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useGenerate, useGeneration } from "../api/queries";
import { useEditorStore } from "../store";
import { Button } from "../components/ui";
import type { ConceptNode as ConceptNodeModel } from "../api/types";

export type ConceptFlowNode = Node<{ concept: ConceptNodeModel }, "concept">;

export function ConceptNode({ data, id }: NodeProps<ConceptFlowNode>) {
  const { concept } = data;
  const selectedNode = useEditorStore((s) => s.selectedNode);
  const runningGenerationId = useEditorStore(
    (s) => s.runningGenerationByConcept[concept.id],
  );
  const setRunningGeneration = useEditorStore((s) => s.setRunningGeneration);
  const showToast = useEditorStore((s) => s.showToast);

  const generateMutation = useGenerate();
  const generationQuery = useGeneration(runningGenerationId);
  const isRunning =
    !!runningGenerationId && generationQuery.data?.status !== "done" &&
    generationQuery.data?.status !== "failed";

  useEffect(() => {
    if (
      runningGenerationId &&
      generationQuery.data &&
      generationQuery.data.status !== "running"
    ) {
      setRunningGeneration(concept.id, null);
    }
  }, [runningGenerationId, generationQuery.data?.status, concept.id, setRunningGeneration]);

  const isSelected = selectedNode?.type === "concept" && selectedNode.id === id;
  const isDraft = concept.status === "draft";
  const canGenerate = isDraft ? concept.body.trim().length > 0 : true;

  const handleGenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    generateMutation.mutate(concept.id, {
      onSuccess: (generation) => setRunningGeneration(concept.id, generation.id),
      onError: (err) => showToast(err.message),
    });
  };

  return (
    <div
      className={`w-[260px] rounded-md border-l-4 bg-white p-3 shadow-sm ${
        isDraft ? "border-l-amber-400" : "border-l-emerald-500"
      } ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        className="!left-0 !top-0 !h-4 !w-full !transform-none !rounded-none !border-0 !opacity-0"
      />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isDraft ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {isDraft ? "Draft" : "Committed"}
        </span>
      </div>

      <h3 className="mb-1 truncate text-sm font-semibold text-gray-900">
        {concept.title || "Untitled draft"}
      </h3>
      <p className="mb-2 line-clamp-4 text-xs text-gray-600">
        {concept.body || "No description yet."}
      </p>

      <Button
        variant="primary"
        className="nodrag w-full"
        disabled={!canGenerate || isRunning || generateMutation.isPending}
        onClick={handleGenerate}
      >
        {isRunning || generateMutation.isPending ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Generating...
          </>
        ) : isDraft ? (
          "Generate"
        ) : (
          "Generate more"
        )}
      </Button>

      <Handle
        type="source"
        position={Position.Bottom}
        title="Drag onto empty canvas to branch, or onto a concept to add it as a parent"
        className="!h-6 !w-6 !cursor-crosshair !rounded-full !border-2 !border-white !bg-indigo-600 transition-transform hover:!scale-125 hover:!bg-indigo-700"
      >
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold leading-none text-white">
          +
        </span>
      </Handle>
    </div>
  );
}
