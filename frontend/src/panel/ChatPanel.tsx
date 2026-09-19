// Refinement chat for a draft concept. One LLM operation (refine) backs
// this; see docs/concept.md "Refinement chat".
//
// Extension point: `attachedImageIds` (from the Zustand store, keyed by
// concept id) is rendered as removable chips and sent with the next message.
// The next slice will populate it by letting the user drag an image node
// from the canvas onto this composer; nothing else here needs to change.
import { useState } from "react";
import { useChat, usePostChat } from "../api/queries";
import { useEditorStore } from "../store";
import { Button, Textarea } from "../components/ui";

// Stable fallback so the Zustand selector returns the same reference when
// nothing is attached; a fresh `[]` per render triggers an infinite re-render.
const NO_ATTACHMENTS: string[] = [];

export function ChatPanel({ conceptId }: { conceptId: string }) {
  const chatQuery = useChat(conceptId);
  const postChat = usePostChat();
  const [draft, setDraft] = useState("");

  const attachedImageIds = useEditorStore(
    (s) => s.attachedImageIds[conceptId] ?? NO_ATTACHMENTS,
  );
  const setAttachedImageIds = useEditorStore((s) => s.setAttachedImageIds);
  const showToast = useEditorStore((s) => s.showToast);

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
                {message.attached_image_ids.map((id) => (
                  <span
                    key={id}
                    className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-500"
                  >
                    img:{id.slice(0, 8)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {attachedImageIds.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {attachedImageIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
            >
              img:{id.slice(0, 8)}
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
          ))}
        </div>
      )}

      {/* Extension point: onDragOver/onDrop here (next slice) reads the
          dragged image node id and appends it via setAttachedImageIds,
          matching the drag source added to ImageNode.tsx. */}
      <Textarea
        rows={2}
        placeholder="Describe the idea, or ask for a refinement... (Enter to send, Shift+Enter for newline)"
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
  );
}
