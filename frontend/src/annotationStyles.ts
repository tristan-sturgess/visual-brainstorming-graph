// Colors for the three annotation kinds, shared by the canvas node (passive
// overlays) and the image panel (drawing surface + buttons).
import type { Annotation } from "./api/types";

export const ANNOTATION_KIND_STYLE: Record<
  Annotation["kind"],
  { label: string; stroke: string; fill: string; button: string; buttonActive: string }
> = {
  like: {
    label: "Like",
    stroke: "#16a34a",
    fill: "rgba(22, 163, 74, 0.15)",
    button: "bg-green-600 hover:bg-green-700",
    buttonActive: "bg-green-700 ring-2 ring-green-300",
  },
  dislike: {
    label: "Dislike",
    stroke: "#dc2626",
    fill: "rgba(220, 38, 38, 0.15)",
    button: "bg-red-600 hover:bg-red-700",
    buttonActive: "bg-red-700 ring-2 ring-red-300",
  },
  note: {
    label: "Note",
    stroke: "#64748b",
    fill: "rgba(100, 116, 139, 0.15)",
    button: "bg-slate-600 hover:bg-slate-700",
    buttonActive: "bg-slate-700 ring-2 ring-slate-300",
  },
};
