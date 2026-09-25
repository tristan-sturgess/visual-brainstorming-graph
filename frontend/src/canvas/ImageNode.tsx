// Image card. The target handle only exists to render the derived
// "produced by" edge from its generating concept and is not connectable by
// the user. The source handle is dragged out to use this image as a parent
// (branch or add-parent onto a draft).
//
// Regional annotations (docs/regional-annotations.md) are drawn and deleted
// in the right-hand ImagePanel.tsx. Here they only render as
// percentage-positioned, non-interactive overlays (pointer-events: none) so
// a rectangle never blocks dragging the node.
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useEditorStore } from "../store";
import { ANNOTATION_KIND_STYLE } from "../annotationStyles";
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
        className="!opacity-0"
      />

      <div className="mb-1 flex items-center">
        <span
          draggable
          title="Drag into chat to attach as context"
          className="nodrag flex cursor-grab select-none items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-200 active:cursor-grabbing"
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-vbg-image-id", id);
            e.dataTransfer.effectAllowed = "copy";
          }}
        >
          ⠿ Drag to chat
        </span>
      </div>

      <div className="relative rounded">
        <img src={image.url} alt="" className="block w-full rounded" draggable={false} />

        {image.source === "uploaded" && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            uploaded
          </span>
        )}

        <div className="pointer-events-none absolute inset-0">
          {image.annotations.map((annotation) => {
            const style = ANNOTATION_KIND_STYLE[annotation.kind];
            return (
              <div
                key={annotation.id}
                className="absolute"
                style={{
                  left: `${annotation.x * 100}%`,
                  top: `${annotation.y * 100}%`,
                  width: `${annotation.w * 100}%`,
                  height: `${annotation.h * 100}%`,
                  border: `2px solid ${style.stroke}`,
                  backgroundColor: style.fill,
                }}
              />
            );
          })}
        </div>
      </div>

      {firstFeedbackLine && (
        <p className="mt-1.5 truncate text-xs text-gray-600">{firstFeedbackLine}</p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        title="Drag onto empty canvas to branch, or onto a draft concept to add it as a parent"
        className="!h-6 !w-6 !cursor-crosshair !rounded-full !border-2 !border-white !bg-indigo-600 transition-transform hover:!scale-125 hover:!bg-indigo-700"
      >
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold leading-none text-white">
          +
        </span>
      </Handle>
    </div>
  );
}
