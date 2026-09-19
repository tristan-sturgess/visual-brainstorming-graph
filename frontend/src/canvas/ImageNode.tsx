// Image card. The target handle only exists to render the derived
// "produced by" edge from its generating concept and is not connectable by
// the user. The source handle is dragged out to use this image as a parent
// (branch or add-parent onto a draft).
//
// Hovering the image reveals a like/dislike/note toolbar (docs/regional-
// annotations.md). Picking a kind puts this node into annotation mode
// (Zustand `annotationMode`); dragging on the image then draws a normalized
// rectangle, which is POSTed as an Annotation. Existing annotations render
// as percentage-positioned, non-interactive overlays (pointer-events: none)
// so a rectangle never blocks dragging the node; deleting an annotation
// happens from ImagePanel.tsx instead of on the canvas.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useCreateAnnotation } from "../api/queries";
import { useEditorStore } from "../store";
import type { Annotation, ImageNode as ImageNodeModel } from "../api/types";

export type ImageFlowNode = Node<{ image: ImageNodeModel }, "image">;

type AnnotationKind = Annotation["kind"];
type NormRect = { x: number; y: number; w: number; h: number };

const KIND_STYLE: Record<AnnotationKind, { stroke: string; fill: string; label: string }> = {
  like: { stroke: "#16a34a", fill: "rgba(22, 163, 74, 0.15)", label: "Like" },
  dislike: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.15)", label: "Dislike" },
  note: { stroke: "#64748b", fill: "rgba(100, 116, 139, 0.15)", label: "Note" },
};

const MIN_SIZE = 0.02;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function rectFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): NormRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

export function ImageNode({ data, id }: NodeProps<ImageFlowNode>) {
  const { image } = data;
  const selectedNode = useEditorStore((s) => s.selectedNode);
  const annotationMode = useEditorStore((s) => s.annotationMode);
  const setAnnotationMode = useEditorStore((s) => s.setAnnotationMode);
  const showToast = useEditorStore((s) => s.showToast);
  const createAnnotation = useCreateAnnotation();

  const isSelected = selectedNode?.type === "image" && selectedNode.id === id;
  const firstFeedbackLine = image.feedback.split("\n")[0];
  const isAnnotating = annotationMode !== null && annotationMode.imageId === id;
  const activeKind = annotationMode && annotationMode.imageId === id ? annotationMode.kind : null;

  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<NormRect | null>(null);
  const [noteDraft, setNoteDraft] = useState<NormRect | null>(null);
  const [noteText, setNoteText] = useState("");

  const pointFromEvent = (e: ReactPointerEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const toggleKind = (kind: AnnotationKind) => {
    if (isAnnotating && activeKind === kind) {
      setAnnotationMode(null);
    } else {
      setAnnotationMode({ imageId: id, kind });
    }
    setDragRect(null);
    setNoteDraft(null);
  };

  // Escape exits annotation mode for this image (cancelling any note popover
  // first, if one is open). Only the active image listens.
  useEffect(() => {
    if (!isAnnotating) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // First Escape closes an open note popover; the next one exits
      // annotation mode. Read `noteDraft` from the closure (it is a dep)
      // rather than inside a state updater, which React forbids from
      // updating other components.
      if (noteDraft) {
        setNoteDraft(null);
      } else {
        setAnnotationMode(null);
      }
      setDragRect(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAnnotating, noteDraft, setAnnotationMode]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isAnnotating) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = pointFromEvent(e);
    setDragRect({ x: dragStart.current.x, y: dragStart.current.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isAnnotating || !dragStart.current) return;
    setDragRect(rectFromPoints(dragStart.current, pointFromEvent(e)));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isAnnotating || !dragStart.current) return;
    const finalRect = rectFromPoints(dragStart.current, pointFromEvent(e));
    dragStart.current = null;

    if (finalRect.w <= MIN_SIZE || finalRect.h <= MIN_SIZE) {
      setDragRect(null);
      return;
    }

    if (activeKind === "note") {
      setDragRect(null);
      setNoteText("");
      setNoteDraft(finalRect);
      return;
    }

    createAnnotation.mutate(
      { imageId: id, body: { kind: activeKind as AnnotationKind, ...finalRect, note: "" } },
      { onError: (err) => showToast(err.message) },
    );
    setDragRect(null);
  };

  const submitNote = () => {
    if (!noteDraft) return;
    const note = noteText.trim();
    if (!note) {
      setNoteDraft(null);
      return;
    }
    createAnnotation.mutate(
      { imageId: id, body: { kind: "note", ...noteDraft, note } },
      { onError: (err) => showToast(err.message) },
    );
    setNoteDraft(null);
  };

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

      <div className="group relative rounded">
        <img src={image.url} alt="" className="block w-full rounded" draggable={false} />

        {image.source === "uploaded" && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
            uploaded
          </span>
        )}

        {/* Hover toolbar: like / dislike / note. Stays visible while this
            image is the active annotation target even if the pointer is
            mid-drag over the image. */}
        <div
          className={`nodrag absolute left-1/2 top-1.5 z-20 flex -translate-x-1/2 gap-1 transition-opacity ${
            isAnnotating ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <button
            type="button"
            title="Like"
            onClick={(e) => {
              e.stopPropagation();
              toggleKind("like");
            }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow ${
              activeKind === "like" ? "bg-green-700 ring-2 ring-white" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            Like
          </button>
          <button
            type="button"
            title="Dislike"
            onClick={(e) => {
              e.stopPropagation();
              toggleKind("dislike");
            }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow ${
              activeKind === "dislike" ? "bg-red-700 ring-2 ring-white" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            Dislike
          </button>
          <button
            type="button"
            title="Note"
            onClick={(e) => {
              e.stopPropagation();
              toggleKind("note");
            }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow ${
              activeKind === "note" ? "bg-slate-700 ring-2 ring-white" : "bg-slate-600 hover:bg-slate-700"
            }`}
          >
            Note
          </button>
        </div>

        {/* Existing annotations are purely visual: pointer-events: none and
            no `nodrag`, so grabbing the image anywhere (including on top of
            a rectangle) still drags the node. Deleting an annotation is
            done from ImagePanel.tsx. */}
        <div className="pointer-events-none absolute inset-0">
          {image.annotations.map((annotation) => {
            const style = KIND_STYLE[annotation.kind];
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

        {/* Drawing surface, only mounted while this image is being
            annotated. nodrag/nopan suppress node dragging and canvas
            panning while the user drags out a rectangle. */}
        {isAnnotating && (
          <div
            ref={overlayRef}
            className="nodrag nopan absolute inset-0 z-10 cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {dragRect && activeKind && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${dragRect.x * 100}%`,
                  top: `${dragRect.y * 100}%`,
                  width: `${dragRect.w * 100}%`,
                  height: `${dragRect.h * 100}%`,
                  border: `2px solid ${KIND_STYLE[activeKind].stroke}`,
                  backgroundColor: KIND_STYLE[activeKind].fill,
                }}
              />
            )}
          </div>
        )}

        {noteDraft && (
          <div
            className="nodrag absolute z-30 w-40 rounded-md border border-gray-300 bg-white p-1.5 shadow-lg"
            style={{
              left: `${Math.min(noteDraft.x * 100, 60)}%`,
              top: `${Math.min((noteDraft.y + noteDraft.h) * 100, 80)}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={noteText}
              placeholder="Note (required)"
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNote();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setNoteDraft(null);
                }
              }}
              className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-400"
            />
          </div>
        )}
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
