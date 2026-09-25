// Right-panel view for a selected image node: the image large, with the
// like / dislike / note buttons directly under it, then provenance, a
// debounced feedback textarea, the list of regional annotations, and delete
// (backend enforces the deletion rules; 409s are surfaced as a toast).
//
// Annotations are drawn here, on the large image (docs/regional-
// annotations.md). Picking a kind arms the drawing surface; dragging on the
// image draws a normalized rectangle, which is POSTed as an Annotation.
// Clicking the active kind again, or pressing Escape, exits drawing mode.
// Drawing mode is local to this panel and resets when the selected image
// changes. Rectangles smaller than 2% in either dimension are discarded.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  useCreateAnnotation,
  useDeleteAnnotation,
  useDeleteImage,
  usePatchImage,
} from "../api/queries";
import { useEditorStore } from "../store";
import { ANNOTATION_KIND_STYLE } from "../annotationStyles";
import { Button, Textarea } from "../components/ui";
import type { Annotation, ConceptNode, ImageNode } from "../api/types";

type AnnotationKind = Annotation["kind"];
type NormRect = { x: number; y: number; w: number; h: number };

const KINDS: AnnotationKind[] = ["like", "dislike", "note"];

const KIND_BADGE: Record<AnnotationKind, string> = {
  like: "bg-green-100 text-green-700",
  dislike: "bg-red-100 text-red-700",
  note: "bg-slate-100 text-slate-700",
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

function rectStyle(rect: NormRect, kind: AnnotationKind) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
    border: `2px solid ${ANNOTATION_KIND_STYLE[kind].stroke}`,
    backgroundColor: ANNOTATION_KIND_STYLE[kind].fill,
  };
}

export function ImagePanel({
  image,
  producingConcept,
}: {
  image: ImageNode;
  producingConcept: ConceptNode | undefined;
}) {
  const [feedback, setFeedback] = useState(image.feedback);
  const patchImage = usePatchImage();
  const deleteImage = useDeleteImage();
  const createAnnotation = useCreateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();
  const selectNode = useEditorStore((s) => s.selectNode);
  const showToast = useEditorStore((s) => s.showToast);

  const [activeKind, setActiveKind] = useState<AnnotationKind | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<NormRect | null>(null);
  const [noteDraft, setNoteDraft] = useState<NormRect | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    setFeedback(image.feedback);
    setActiveKind(null);
    setDragRect(null);
    setNoteDraft(null);
  }, [image.id]);

  const toggleKind = (kind: AnnotationKind) => {
    setActiveKind((current) => (current === kind ? null : kind));
    setDragRect(null);
    setNoteDraft(null);
  };

  // First Escape closes an open note popover; the next one exits drawing mode.
  useEffect(() => {
    if (!activeKind) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (noteDraft) {
        setNoteDraft(null);
      } else {
        setActiveKind(null);
      }
      setDragRect(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeKind, noteDraft]);

  const pointFromEvent = (e: ReactPointerEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeKind || noteDraft) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = pointFromEvent(e);
    setDragRect({ x: dragStart.current.x, y: dragStart.current.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeKind || !dragStart.current) return;
    setDragRect(rectFromPoints(dragStart.current, pointFromEvent(e)));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeKind || !dragStart.current) return;
    const finalRect = rectFromPoints(dragStart.current, pointFromEvent(e));
    dragStart.current = null;
    setDragRect(null);

    if (finalRect.w <= MIN_SIZE || finalRect.h <= MIN_SIZE) return;

    if (activeKind === "note") {
      setNoteText("");
      setNoteDraft(finalRect);
      return;
    }

    createAnnotation.mutate(
      { imageId: image.id, body: { kind: activeKind, ...finalRect, note: "" } },
      { onError: (err) => showToast(err.message) },
    );
  };

  const submitNote = () => {
    if (!noteDraft) return;
    const note = noteText.trim();
    if (!note) {
      setNoteDraft(null);
      return;
    }
    createAnnotation.mutate(
      { imageId: image.id, body: { kind: "note", ...noteDraft, note } },
      { onError: (err) => showToast(err.message) },
    );
    setNoteDraft(null);
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = (next: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      patchImage.mutate(
        { id: image.id, body: { feedback: next } },
        { onError: (err) => showToast(err.message) },
      );
    }, 500);
  };

  const handleDelete = () => {
    deleteImage.mutate(image.id, {
      onSuccess: () => selectNode(null),
      onError: (err) => showToast(err.message),
    });
  };

  const provenance =
    image.source === "uploaded"
      ? "Uploaded"
      : `Generated by ${producingConcept?.title || "an unknown concept"}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div>
        <div
          className={`relative select-none overflow-hidden rounded-md border ${
            activeKind ? "border-indigo-400 ring-2 ring-indigo-200" : "border-gray-200"
          }`}
        >
          <img src={image.url} alt="" className="block w-full" draggable={false} />

          {/* Existing rectangles. */}
          <div className="pointer-events-none absolute inset-0">
            {image.annotations.map((annotation) => (
              <div
                key={annotation.id}
                className="absolute"
                style={rectStyle(annotation, annotation.kind)}
              />
            ))}
          </div>

          {/* Drawing surface, only mounted while a kind is armed. */}
          {activeKind && (
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {dragRect && (
                <div className="pointer-events-none absolute" style={rectStyle(dragRect, activeKind)} />
              )}
              {noteDraft && (
                <div className="pointer-events-none absolute" style={rectStyle(noteDraft, "note")} />
              )}
            </div>
          )}

          {noteDraft && (
            <div
              className="absolute z-10 w-48 rounded-md border border-gray-300 bg-white p-1.5 shadow-lg"
              style={{
                left: `${Math.min(noteDraft.x * 100, 55)}%`,
                top: `${Math.min((noteDraft.y + noteDraft.h) * 100, 85)}%`,
              }}
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

        <div className="mt-2 flex items-center gap-1.5">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`rounded px-2 py-1 text-xs font-semibold text-white shadow-sm ${
                activeKind === kind
                  ? ANNOTATION_KIND_STYLE[kind].buttonActive
                  : ANNOTATION_KIND_STYLE[kind].button
              }`}
            >
              {ANNOTATION_KIND_STYLE[kind].label}
            </button>
          ))}
          <span className="ml-1 text-xs text-gray-400">
            {activeKind
              ? `Drag a ${ANNOTATION_KIND_STYLE[activeKind].label.toLowerCase()} rectangle on the image. Esc to finish.`
              : "Pick a kind, then drag a rectangle on the image."}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-500">{provenance}</p>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Feedback
        </label>
        <Textarea
          rows={4}
          placeholder="What works, what doesn't..."
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            scheduleSave(e.target.value);
          }}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Annotations
        </label>
        {image.annotations.length === 0 ? (
          <p className="text-xs text-gray-400">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {image.annotations.map((annotation) => (
              <li
                key={annotation.id}
                className="flex items-start justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_BADGE[annotation.kind]}`}
                  >
                    {annotation.kind}
                  </span>
                  <span className="text-xs text-gray-700">
                    {annotation.note || <span className="text-gray-400">No note</span>}
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs text-gray-400 hover:text-red-600"
                  onClick={() =>
                    deleteAnnotation.mutate(annotation.id, {
                      onError: (err) => showToast(err.message),
                    })
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button variant="danger" className="self-start" onClick={handleDelete} disabled={deleteImage.isPending}>
        Delete
      </Button>
    </div>
  );
}
