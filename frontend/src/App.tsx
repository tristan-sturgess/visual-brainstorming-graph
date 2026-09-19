// Full-viewport layout: a slim top bar, the graph canvas on the left, and a
// fixed-width right panel showing the selected node's details.
import { useEffect, useRef, type DragEvent, type RefObject } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useGraph, useCreateConcept, useUploadImage } from "./api/queries";
import { useEditorStore } from "./store";
import { GraphCanvas } from "./canvas/GraphCanvas";
import { RightPanel } from "./panel/RightPanel";
import { Button } from "./components/ui";
import type { Graph } from "./api/types";

const emptyGraph: Graph = { concepts: [], images: [], edges: [] };

function TopBar({
  onNewConcept,
  newConceptPending,
  onUploadClick,
  uploadPending,
  fileInputRef,
  onFileChange,
}: {
  onNewConcept: () => void;
  newConceptPending: boolean;
  onUploadClick: () => void;
  uploadPending: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (file: File) => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      <span className="text-sm font-semibold text-gray-900">Visual Brainstorming Graph</span>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileChange(file);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={onUploadClick} disabled={uploadPending}>
          Upload image
        </Button>
        <Button onClick={onNewConcept} disabled={newConceptPending}>
          New concept
        </Button>
      </div>
    </header>
  );
}

function Toast() {
  const toast = useEditorStore((s) => s.toast);
  const clearToast = useEditorStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 4000);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <div className="pointer-events-auto rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
        {toast}
      </div>
    </div>
  );
}

function AppShell() {
  const graphQuery = useGraph();
  const graph = graphQuery.data ?? emptyGraph;

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const selectNode = useEditorStore((s) => s.selectNode);
  const showToast = useEditorStore((s) => s.showToast);
  const createConcept = useCreateConcept();
  const uploadImage = useUploadImage();

  const viewportCenter = () => {
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    return rect
      ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
  };

  const handleNewConcept = () => {
    createConcept.mutate(
      { position: viewportCenter(), parent_ids: [] },
      {
        onSuccess: (concept) => selectNode({ type: "concept", id: concept.id }),
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleUploadFile = (file: File) => {
    uploadImage.mutate(
      { file, position: viewportCenter() },
      {
        onSuccess: (image) => selectNode({ type: "image", id: image.id }),
        onError: (err) => showToast(err.message),
      },
    );
  };

  // Safety net: a file dropped anywhere in the app that isn't handled by an
  // inner drop target (canvas, chat composer) must not fall through to the
  // browser's default of navigating the tab to the file. Inner handlers
  // don't stopPropagation, so this still fires after them; it only needs to
  // preventDefault, not act on the drop.
  const preventDefault = (e: DragEvent) => e.preventDefault();

  return (
    <div
      className="flex h-screen w-screen flex-col"
      onDragOver={preventDefault}
      onDrop={preventDefault}
    >
      <TopBar
        onNewConcept={handleNewConcept}
        newConceptPending={createConcept.isPending}
        onUploadClick={() => fileInputRef.current?.click()}
        uploadPending={uploadImage.isPending}
        fileInputRef={fileInputRef}
        onFileChange={handleUploadFile}
      />

      <div className="flex flex-1 overflow-hidden">
        <div ref={canvasWrapperRef} className="relative flex-1">
          {graphQuery.isError && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 shadow">
              Backend unreachable. Showing an empty graph.
            </div>
          )}
          <GraphCanvas graph={graph} screenToFlowPosition={screenToFlowPosition} />
        </div>

        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
          <RightPanel graph={graph} />
        </aside>
      </div>

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
}
