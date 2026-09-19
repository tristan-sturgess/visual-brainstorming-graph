// Right-panel view for a selected concept. Draft: editable text (debounced
// PATCH), Generate, Delete, and the chat. Committed: read-only text, a
// "Compiled prompt" disclosure, and Generate more.
import { useEffect, useRef, useState } from "react";
import { useDeleteConcept, useGenerate, useGeneration, usePatchConcept } from "../api/queries";
import { useEditorStore } from "../store";
import { Button, Input, Textarea } from "../components/ui";
import type { ConceptNode, PatchConceptRequest } from "../api/types";
import { ChatPanel } from "./ChatPanel";

export function ConceptPanel({ concept }: { concept: ConceptNode }) {
  const isDraft = concept.status === "draft";

  const [title, setTitle] = useState(concept.title);
  const [body, setBody] = useState(concept.body);
  // Dirty flags: set on user input, cleared once that field's PATCH lands.
  // A field only resyncs from the server while it is neither dirty nor
  // focused, so a mid-keystroke server update (e.g. from chat refine) never
  // clobbers what the user is typing, and we never send a stale sibling
  // field alongside the one the user actually changed.
  const [titleDirty, setTitleDirty] = useState(false);
  const [bodyDirty, setBodyDirty] = useState(false);
  const titleFocused = useRef(false);
  const bodyFocused = useRef(false);
  // Per-field generation counters, bumped on every keystroke. A PATCH's
  // onSuccess captures the version it sent and only clears that field's
  // dirty flag if no newer keystroke has landed since, so a keystroke typed
  // while a request is in flight is never silently dropped by a stale
  // onSuccess clearing the flag out from under it.
  const titleVersion = useRef(0);
  const bodyVersion = useRef(0);
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

  // Switching to a different concept hard-resets local text and dirty
  // state. Staying on the same concept but seeing `updated_at` change
  // (server-side edit, e.g. chat refine) resyncs only the fields the user
  // isn't actively editing or hasn't unsaved changes in.
  const prevConceptId = useRef(concept.id);
  useEffect(() => {
    if (prevConceptId.current !== concept.id) {
      prevConceptId.current = concept.id;
      setTitle(concept.title);
      setBody(concept.body);
      setTitleDirty(false);
      setBodyDirty(false);
      return;
    }
    if (!titleDirty && !titleFocused.current) setTitle(concept.title);
    if (!bodyDirty && !bodyFocused.current) setBody(concept.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept.id, concept.updated_at]);

  // Latest local values/dirty flags for the debounce timer to read, so a
  // timer scheduled on an earlier keystroke still sends the newest text.
  const latest = useRef({ title, body, titleDirty, bodyDirty });
  latest.current = { title, body, titleDirty, bodyDirty };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { title: t, body: b, titleDirty: td, bodyDirty: bd } = latest.current;
      if (!td && !bd) return;
      // Snapshot the versions this PATCH covers so onSuccess can tell
      // whether a newer keystroke has arrived since it was sent.
      const sentTitleVersion = titleVersion.current;
      const sentBodyVersion = bodyVersion.current;
      const patchBody: PatchConceptRequest = {};
      if (td) patchBody.title = t;
      if (bd) patchBody.body = b;
      patchConcept.mutate(
        { id: concept.id, body: patchBody },
        {
          onSuccess: () => {
            if (td && titleVersion.current === sentTitleVersion) setTitleDirty(false);
            if (bd && bodyVersion.current === sentBodyVersion) setBodyDirty(false);
          },
          onError: (err) => showToast(err.message),
        },
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
            onFocus={() => (titleFocused.current = true)}
            onBlur={() => (titleFocused.current = false)}
            onChange={(e) => {
              titleVersion.current += 1;
              setTitle(e.target.value);
              setTitleDirty(true);
              scheduleSave();
            }}
          />
          <Textarea
            rows={5}
            placeholder="Describe the idea, or let chat write it for you..."
            value={body}
            onFocus={() => (bodyFocused.current = true)}
            onBlur={() => (bodyFocused.current = false)}
            onChange={(e) => {
              bodyVersion.current += 1;
              setBody(e.target.value);
              setBodyDirty(true);
              scheduleSave();
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
