// Image card. The target handle only exists to render the derived
// "produced by" edge from its generating concept and is not connectable by
// the user. The source handle is dragged out to use this image as a parent
// (branch or add-parent onto a draft).
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditorStore } from "../store";
import type { ImageNode as ImageNodeModel } from "../api/types";

export type ImageFlowNode = Node<{ image: ImageNodeModel }, "image">;

export function ImageNode({ data, id }: NodeProps<ImageFlowNode>) {
  const { image } = data;
  const selectedNode = useEditorStore((s) => s.selectedNode);
  const isSelected = selectedNode?.type === "image" && selectedNode.id === id;
  const firstFeedbackLine = image.feedback.split("\n")[0];

  return (
    <div
      className={`w-[240px] rounded-md border border-gray-200 bg-white p-2 shadow-sm ${
        isSelected ? "ring-2 ring-indigo-500" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!bg-gray-300"
      />

      {/* Extension point: the annotation overlay (SVG rectangles, draw
          toolbar) mounts here, absolutely positioned over the <img>, using
          the nodrag/nopan classes while drawing per
          docs/tech-stack-and-architecture.md "Regional annotations". */}
      <div className="relative overflow-hidden rounded">
        {/* Extension point: drag-into-chat (next slice) sets draggable and
            onDragStart here (native HTML5 DnD, node id as payload, per
            docs/tech-stack-and-architecture.md "Uploads and drag-and-drop"),
            and ChatPanel's composer becomes the onDrop target. */}
        <img src={image.url} alt="" className="block w-full rounded" draggable={false} />
        <div className="pointer-events-none absolute inset-0" data-annotation-overlay-slot="" />
        {image.source === "uploaded" && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            uploaded
          </span>
        )}
      </div>

      {firstFeedbackLine && (
        <p className="mt-1.5 truncate text-xs text-gray-600">{firstFeedbackLine}</p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}
