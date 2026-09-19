// The graph canvas. Renders concepts and images as React Flow nodes and
// derives two kinds of edges: stored parent edges (Edge[] from the API) and
// produced-by edges (derived from ImageNode.concept_id, not stored).
//
// Node position and selection are left to React Flow's own internal state
// (we do not wire onNodesChange); we only persist position on drag end and
// react to selection/deletion through their dedicated callbacks. This keeps
// dragging smooth while the server remains the source of truth for layout.
import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
      const droppedOnPane = !!target?.closest?.(".react-flow__pane");
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

  // Extension point: dropping an image file onto the canvas (next slice)
  // wires onDragOver/onDrop here, converts the drop point with
  // screenToFlowPosition, and calls useUploadImage() (already implemented
  // in src/api/queries.ts) to create the uploaded image node.
  return (
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
      fitView
      minZoom={0.2}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
      <MiniMap pannable zoomable className="!bg-white" />
      <Controls />
    </ReactFlow>
  );
}
