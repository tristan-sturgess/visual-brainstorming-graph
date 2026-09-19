// The graph canvas. Renders concepts and images as React Flow nodes and
// derives two kinds of edges: stored parent edges (Edge[] from the API) and
// produced-by edges (derived from ImageNode.concept_id, not stored).
//
// Node position and selection are left to React Flow's own internal state
// (we do not wire onNodesChange); we only persist position on drag end and
// react to selection/deletion through their dedicated callbacks. This keeps
// dragging smooth while the server remains the source of truth for layout.
import { useCallback, useMemo, type DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type Edge as RFEdge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnConnect,
  type OnConnectEnd,
  type OnEdgesDelete,
  type OnNodeDrag,
  type OnNodesDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useAddConceptParent,
  useCreateConcept,
  useDeleteConcept,
  usePatchConcept,
  usePatchImage,
  useRemoveConceptParent,
  useUploadImage,
} from "../api/queries";
import { useEditorStore } from "../store";
import type { Graph } from "../api/types";
import { ConceptNode, type ConceptFlowNode } from "./ConceptNode";
import { ImageNode, type ImageFlowNode } from "./ImageNode";

type FlowNode = ConceptFlowNode | ImageFlowNode;

const nodeTypes: NodeTypes = {
  concept: ConceptNode,
  image: ImageNode,
};

export function GraphCanvas({
  graph,
  screenToFlowPosition,
}: {
  graph: Graph;
  screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
}) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const showToast = useEditorStore((s) => s.showToast);

  const createConcept = useCreateConcept();
  const addParent = useAddConceptParent();
  const removeParent = useRemoveConceptParent();
  const patchConcept = usePatchConcept();
  const patchImage = usePatchImage();
  const deleteConcept = useDeleteConcept();
  const uploadImage = useUploadImage();

  const nodes = useMemo<FlowNode[]>(() => {
    const conceptNodes: ConceptFlowNode[] = graph.concepts.map((concept) => ({
      id: concept.id,
      type: "concept",
      position: concept.position,
      data: { concept },
      deletable: concept.status === "draft",
    }));
    const imageNodes: ImageFlowNode[] = graph.images.map((image) => ({
      id: image.id,
      type: "image",
      position: image.position,
      data: { image },
      deletable: false,
    }));
    return [...conceptNodes, ...imageNodes];
  }, [graph]);

  const edges = useMemo<RFEdge[]>(() => {
    const parentEdges: RFEdge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source_id,
      target: edge.target_id,
      deletable: true,
    }));
    const producedEdges: RFEdge[] = graph.images
      .filter((image) => image.concept_id)
      .map((image) => ({
        id: `produced-${image.id}`,
        source: image.concept_id as string,
        target: image.id,
        deletable: false,
        selectable: false,
        style: { strokeDasharray: "5 4", stroke: "#c7c7d1" },
      }));
    return [...parentEdges, ...producedEdges];
  }, [graph]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      addParent.mutate(
        { id: connection.target, body: { node_id: connection.source } },
        { onError: (err) => showToast(err.message) },
      );
    },
    [addParent, showToast],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid) return; // handled by onConnect instead
      if (!connectionState.fromNode) return;

      const target = event.target as HTMLElement | null;
      const droppedOnPane = !!target?.classList?.contains("react-flow__pane");
      if (!droppedOnPane) return;

      const point =
        "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
      const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });

      createConcept.mutate(
        { position, parent_ids: [connectionState.fromNode.id] },
        {
          onSuccess: (concept) => selectNode({ type: "concept", id: concept.id }),
          onError: (err) => showToast(err.message),
        },
      );
    },
    [createConcept, screenToFlowPosition, selectNode, showToast],
  );

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    (_event, node) => {
      if (node.type === "concept") {
        patchConcept.mutate({ id: node.id, body: { position: node.position } });
      } else if (node.type === "image") {
        patchImage.mutate({ id: node.id, body: { position: node.position } });
      }
    },
    [patchConcept, patchImage],
  );

  const onNodeClick: NodeMouseHandler<FlowNode> = useCallback(
    (_event, node) => {
      if (node.type === "concept" || node.type === "image") {
        selectNode({ type: node.type, id: node.id });
      }
    },
    [selectNode],
  );

  const onPaneClick = useCallback(() => selectNode(null), [selectNode]);

  const onEdgesDelete: OnEdgesDelete = useCallback(
    (deleted) => {
      for (const edge of deleted) {
        removeParent.mutate(
          { id: edge.target, nodeId: edge.source },
          { onError: (err) => showToast(err.message) },
        );
      }
    },
    [removeParent, showToast],
  );

  const onNodesDelete: OnNodesDelete<FlowNode> = useCallback(
    (deleted) => {
      for (const node of deleted) {
        if (node.type !== "concept") continue; // ignore other node types
        deleteConcept.mutate(node.id, { onError: (err) => showToast(err.message) });
      }
    },
    [deleteConcept, showToast],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) return;

      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      files.forEach((file, index) => {
        uploadImage.mutate(
          { file, position: { x: flowPos.x + index * 24, y: flowPos.y + index * 24 } },
          {
            onSuccess: (image) => selectNode({ type: "image", id: image.id }),
            onError: (err) => showToast(err.message),
          },
        );
      });
    },
    [screenToFlowPosition, uploadImage, selectNode, showToast],
  );

  return (
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        colorMode="light"
        fitView
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} bgColor="#f8fafc" color="#cbd5e1" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
