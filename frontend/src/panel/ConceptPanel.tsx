// Right-panel view for a selected concept. Draft: editable text (debounced
// PATCH), Generate, Delete, and the chat. Committed: read-only text, a
// "Compiled prompt" disclosure, and Generate more.
import { useEffect, useRef, useState } from "react";
import { useDeleteConcept, useGenerate, useGeneration, usePatchConcept } from "../api/queries";
import { useEditorStore } from "../store";
import { Button, Input, Textarea } from "../components/ui";
import type { ConceptNode } from "../api/types";
import { ChatPanel } from "./ChatPanel";

export function ConceptPanel({ concept }: { concept: ConceptNode }) {
  const isDraft = concept.status === "draft";

  const [title, setTitle] = useState(concept.title);
  const [body, setBody] = useState(concept.body);
  const patchConcept = usePatchConcept();
  const deleteConcept = useDeleteConcept();
  const selectNode = useEditorStore((s) => s.selectNode);
  const showToast = useEditorStore((s) => s.showToast);

  const runningGenerationId = useEditorStore(
    (s) => s.runningGenerationByConcept[concept.id],
  );
  const setRunningGeneration = useEditorStore((s) => s.setRunningGeneration);
  const generateMutation = useGenerate();
  const generationQuery = useGeneration(runningGenerationId);
  const isRunning =
    !!runningGenerationId &&
    generationQuery.data?.status !== "done" &&
    generationQuery.data?.status !== "failed";

  // Reset local text when switching to a different concept. While editing
  // the same draft, local state is the source of truth until the debounced
  // PATCH lands; the server value is not fought over mid-keystroke.
  useEffect(() => {
    setTitle(concept.title);
    setBody(concept.body);
  }, [concept.id]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      patchConcept.mutate(
        { id: concept.id, body: { title: nextTitle, body: nextBody } },
        { onError: (err) => showToast(err.message) },
      );
    }, 500);
  };

  const handleGenerate = () => {
    generateMutation.mutate(concept.id, {
      onSuccess: (generation) => setRunningGeneration(concept.id, generation.id),
      onError: (err) => showToast(err.message),
    });
  };

  const handleDelete = () => {
    deleteConcept.mutate(concept.id, {
      onSuccess: () => selectNode(null),
      onError: (err) => showToast(err.message),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isDraft ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {isDraft ? "Draft" : "Committed"}
        </span>
        {isDraft && (
          <Button variant="danger" onClick={handleDelete} disabled={deleteConcept.isPending}>
            Delete
          </Button>
        )}
      </div>

      {isDraft ? (
        <>
          <Input
            placeholder="Untitled draft"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave(e.target.value, body);
            }}
          />
          <Textarea
            rows={5}
            placeholder="Describe the idea, or let chat write it for you..."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              scheduleSave(title, e.target.value);
            }}
          />
        </>
      ) : (
        <>
          <h2 className="text-base font-semibold text-gray-900">{concept.title}</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{concept.body}</p>
          <details className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
            <summary className="cursor-pointer select-none font-medium text-gray-600">
              Compiled prompt
            </summary>
            <p className="mt-1.5 whitespace-pre-wrap text-gray-600">
              {concept.compiled_prompt}
            </p>
          </details>
        </>
      )}

      <Button
        variant="primary"
        disabled={(isDraft && !body.trim()) || isRunning}
        onClick={handleGenerate}
      >
        {isRunning ? "Generating..." : isDraft ? "Generate" : "Generate more"}
      </Button>

      {isDraft && <ChatPanel conceptId={concept.id} />}
    </div>
  );
}
