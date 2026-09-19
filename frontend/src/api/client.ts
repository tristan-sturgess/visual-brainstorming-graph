// Thin fetch wrappers, one function per endpoint in docs/api.md.
// Every non-2xx response throws an Error with the server's `detail` message.

import type {
  AddParentRequest,
  Annotation,
  ChatMessage,
  ConceptNode,
  CreateAnnotationRequest,
  CreateConceptRequest,
  Generation,
  Graph,
  ImageNode,
  PatchConceptRequest,
  PatchImageRequest,
  PostChatRequest,
  PostChatResponse,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore body parse errors, use the generic message
    }
    throw new Error(detail);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// --- Graph ---

export function getGraph(): Promise<Graph> {
  return request<Graph>("/api/graph");
}

// --- Concepts ---

export function createConcept(body: CreateConceptRequest): Promise<ConceptNode> {
  return request<ConceptNode>("/api/concepts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchConcept(
  id: string,
  body: PatchConceptRequest,
): Promise<ConceptNode> {
  return request<ConceptNode>(`/api/concepts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteConcept(id: string): Promise<void> {
  return request<void>(`/api/concepts/${id}`, { method: "DELETE" });
}

export function addConceptParent(
  id: string,
  body: AddParentRequest,
): Promise<ConceptNode> {
  return request<ConceptNode>(`/api/concepts/${id}/parents`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function removeConceptParent(
  id: string,
  nodeId: string,
): Promise<ConceptNode> {
  return request<ConceptNode>(`/api/concepts/${id}/parents/${nodeId}`, {
    method: "DELETE",
  });
}

// --- Chat ---

export function getChat(conceptId: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/api/concepts/${conceptId}/chat`);
}

export function postChat(
  conceptId: string,
  body: PostChatRequest,
): Promise<PostChatResponse> {
  return request<PostChatResponse>(`/api/concepts/${conceptId}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Generate ---

export function generate(conceptId: string): Promise<Generation> {
  return request<Generation>(`/api/concepts/${conceptId}/generate`, {
    method: "POST",
  });
}

export function getGeneration(id: string): Promise<Generation> {
  return request<Generation>(`/api/generations/${id}`);
}

// --- Images ---

export function uploadImage(
  file: File,
  position: { x: number; y: number },
): Promise<ImageNode> {
  const form = new FormData();
  form.append("file", file);
  form.append("x", String(position.x));
  form.append("y", String(position.y));
  return request<ImageNode>("/api/images/upload", {
    method: "POST",
    body: form,
  });
}

export function patchImage(
  id: string,
  body: PatchImageRequest,
): Promise<ImageNode> {
  return request<ImageNode>(`/api/images/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteImage(id: string): Promise<void> {
  return request<void>(`/api/images/${id}`, { method: "DELETE" });
}

export function createAnnotation(
  imageId: string,
  body: CreateAnnotationRequest,
): Promise<Annotation> {
  return request<Annotation>(`/api/images/${imageId}/annotations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAnnotation(id: string): Promise<void> {
  return request<void>(`/api/annotations/${id}`, { method: "DELETE" });
}
