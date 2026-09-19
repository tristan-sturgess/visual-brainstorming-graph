// Refinement chat for a draft concept. One LLM operation (refine) backs
// this; see docs/concept.md "Refinement chat".
//
// `attachedImageIds` (from the Zustand store, keyed by concept id) is
// rendered as removable thumbnail chips and sent with the next message.
// Populated by dragging an image node (see ImageNode.tsx's "Drag to chat"
// grip) onto the composer below.
import { useState, type DragEvent } from "react";
import { useChat, useGraph, usePostChat } from "../api/queries";
import { useEditorStore } from "../store";
import { Button, Textarea } from "../components/ui";

// Stable fallback so the Zustand selector returns the same reference when
// nothing is attached; a fresh `[]` per render triggers an infinite re-render.
const NO_ATTACHMENTS: string[] = [];

const IMAGE_DRAG_TYPE = "application/x-vbg-image-id";

export function ChatPanel({ conceptId }: { conceptId: string }) {
  const chatQuery = useChat(conceptId);
  const graphQuery = useGraph();
  const postChat = usePostChat();
  const [draft, setDraft] = useState("");

  const attachedImageIds = useEditorStore(
    (s) => s.attachedImageIds[conceptId] ?? NO_ATTACHMENTS,
  );
  const setAttachedImageIds = useEditorStore((s) => s.setAttachedImageIds);
  const showToast = useEditorStore((s) => s.showToast);

  const imageById = (id: string) => graphQuery.data?.images.find((img) => img.id === id);

  const send = () => {
    const content = draft.trim();
    if (!content || postChat.isPending) return;
    postChat.mutate(
      { conceptId, body: { content, attached_image_ids: attachedImageIds } },
      {
        onSuccess: () => {
          setDraft("");
          setAttachedImageIds(conceptId, []);
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const onComposerDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(IMAGE_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onComposerDrop = (e: DragEvent) => {
    const imageId = e.dataTransfer.getData(IMAGE_DRAG_TYPE);
    if (!imageId) return;
    e.preventDefault();
    if (attachedImageIds.includes(imageId)) return;
    setAttachedImageIds(conceptId, [...attachedImageIds, imageId]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-gray-200 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Chat
      </h3>

      <div className="mb-2 flex-1 space-y-2 overflow-y-auto">
        {chatQuery.isLoading && (
          <p className="text-xs text-gray-400">Loading messages...</p>
        )}
        {chatQuery.data?.length === 0 && (
          <p className="text-xs text-gray-400">
            Describe the idea to have the AI write the concept.
          </p>
        )}
        {chatQuery.data?.map((message) => (
          <div
            key={message.id}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              message.role === "user"
                ? "bg-indigo-50 text-gray-900"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.attached_image_ids.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {message.attached_image_ids.map((id) => {
                  const image = imageById(id);
                  return image ? (
                    <img
                      key={id}
                      src={image.url}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <span
                      key={id}
                      className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-500"
                    >
                      img:{id.slice(0, 8)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {postChat.isPending && (
          <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1.5 text-sm text-gray-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            Refining...
          </div>
        )}
      </div>

      {/* Composer drop target: dragging an image node here (see the "Drag to
          chat" grip in ImageNode.tsx) attaches it as temporary context for
          the next message only; it is never sent to the image model. */}
      <div className="flex flex-col" onDragOver={onComposerDragOver} onDrop={onComposerDrop}>
        {attachedImageIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {attachedImageIds.map((id) => {
              const image = imageById(id);
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded bg-gray-100 p-0.5 pr-1.5 text-[10px] text-gray-600"
                >
                  {image ? (
                    <img src={image.url} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    `img:${id.slice(0, 8)}`
                  )}
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-700"
                    onClick={() =>
                      setAttachedImageIds(
                        conceptId,
                        attachedImageIds.filter((i) => i !== id),
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <Textarea
          rows={2}
          placeholder="Describe the idea, or ask for a refinement... (Enter to send, Shift+Enter for newline). Drag an image node here to attach it as context."
          value={draft}
          disabled={postChat.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          className="mt-2 self-end"
          disabled={!draft.trim() || postChat.isPending}
          onClick={send}
        >
          {postChat.isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
