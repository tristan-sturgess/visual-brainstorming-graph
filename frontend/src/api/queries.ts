// TanStack Query hooks: one graph query, one polling generation query, and
// one mutation per endpoint. Every mutation invalidates the graph query so
// the canvas stays in sync with the backend, which is the source of truth.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./client";
import type {
  AddParentRequest,
  CreateAnnotationRequest,
  CreateConceptRequest,
  PatchConceptRequest,
  PatchImageRequest,
  PostChatRequest,
} from "./types";

export const graphKey = ["graph"] as const;

export function useGraph() {
  return useQuery({
    queryKey: graphKey,
    queryFn: api.getGraph,
  });
}

export function useGeneration(id: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["generation", id] as const,
    queryFn: () => api.getGeneration(id as string),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2000 : false),
  });

  const status = query.data?.status;
  useEffect(() => {
    if (status && status !== "running") {
      queryClient.invalidateQueries({ queryKey: graphKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, id]);

  return query;
}

export function useChat(conceptId: string | null | undefined) {
  return useQuery({
    queryKey: ["chat", conceptId] as const,
    queryFn: () => api.getChat(conceptId as string),
    enabled: !!conceptId,
  });
}

function useInvalidateGraph() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: graphKey });
}

export function useCreateConcept() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: (body: CreateConceptRequest) => api.createConcept(body),
    onSuccess: invalidate,
  });
}

export function usePatchConcept() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchConceptRequest }) =>
      api.patchConcept(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteConcept() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: (id: string) => api.deleteConcept(id),
    onSuccess: invalidate,
  });
}

export function useAddConceptParent() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddParentRequest }) =>
      api.addConceptParent(id, body),
    onSuccess: invalidate,
  });
}

export function useRemoveConceptParent() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ id, nodeId }: { id: string; nodeId: string }) =>
      api.removeConceptParent(id, nodeId),
    onSuccess: invalidate,
  });
}

export function usePostChat() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ conceptId, body }: { conceptId: string; body: PostChatRequest }) =>
      api.postChat(conceptId, body),
    onSuccess: (_data, { conceptId }) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["chat", conceptId] });
    },
  });
}

export function useGenerate() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: (conceptId: string) => api.generate(conceptId),
    onSuccess: invalidate,
  });
}

export function useUploadImage() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ file, position }: { file: File; position: { x: number; y: number } }) =>
      api.uploadImage(file, position),
    onSuccess: invalidate,
  });
}

export function usePatchImage() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchImageRequest }) =>
      api.patchImage(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteImage() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: (id: string) => api.deleteImage(id),
    onSuccess: invalidate,
  });
}

export function useCreateAnnotation() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: ({ imageId, body }: { imageId: string; body: CreateAnnotationRequest }) =>
      api.createAnnotation(imageId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteAnnotation() {
  const invalidate = useInvalidateGraph();
  return useMutation({
    mutationFn: (id: string) => api.deleteAnnotation(id),
    onSuccess: invalidate,
  });
}
