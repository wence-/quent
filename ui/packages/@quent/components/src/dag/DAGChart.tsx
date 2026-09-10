// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
  type RefObject,
} from 'react';
import {
  Background,
  EdgeLabelRenderer,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getSmoothStepPath,
  Position,
  type Node,
  type Edge,
  type EdgeProps,
  type OnMoveStart,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useSelectedNodeIds,
  useSetSelectedNodeIds,
  useSetSelectedOperatorLabel,
  useOperatorSelectionActions,
  useEdgeWidthConfig,
  useEdgeColoring,
  useEdgeColorPalette,
  useSelectedEdgeWidthField,
  useSelectedEdgeColorField,
  useEffectiveHighlightedNodeIds,
  useSetSelectedNodeData,
  useSetDagDisplayedNodeIds,
  useSelectedDagLayoutDirection,
  useSelectedNodeData,
  useGraphInspection,
  useRequestedPipeInspection,
  useSetGraphInspection,
  useDataFlowEnabled,
  useDataFlowMeta,
} from '@quent/hooks';
import { calculateLayout, NODE_LAYOUT_WIDTH, NODE_LAYOUT_HEIGHT, FLOW_BAR_HEIGHT } from './layout';
import type { DAGData } from '../services/query-plan/types';
import { QueryPlanNode, type QueryPlanNodeData } from '../query-plan/QueryPlanNode';
import { DAGLegend } from './DAGLegend';
import { PointerTooltipPortal, type PointerPosition } from '../ui/pointer-tooltip-portal';
import { inspectPipe, resolveInspectedNodeSelections, resolvePipeInspection } from './dagSelection';
import { shouldDimEdgeFromInteraction } from './edgeOpacity';
import { getEdgeInteractionWidth, isEdgeInspectionKey } from './edgeInteraction';
import {
  parseCustomStatistics,
  parseOperatorObservations,
  parsePortStatistics,
} from '../lib/queryBundle.utils';
import {
  continuousColor,
  getOperationTypeColor,
  buildOperatorColorMap,
  inferFieldFormatter,
  type QuantitySpec,
} from '@quent/utils';
import {
  formatEdgeFlowLabel,
  formatEdgeTooltip,
  isSelectedInputEdge,
  normalizeEdgeWidth,
} from '../services/query-plan/flowPresentation';

// Edge geometry constants
const EDGE_STROKE_WIDTH_DEFAULT = 1.5;
const EDGE_STROKE_WIDTH_MIN = 2;
const EDGE_STROKE_WIDTH_RANGE = 23; // stroke = MIN + t * RANGE → [2, 25] px
const EDGE_DIMMED_OPACITY = 0.25;
const EDGE_TRANSITION_MS = 150;
const ARROW_WIDTH_MULTIPLIER = 1.5;
const ARROW_WIDTH_BASE = 8;
const ARROW_DEPTH_RATIO = 0.6;
const FALLBACK_NORMALIZED_T = 0.5; // used when min === max
const SELECTED_INPUT_EDGE_COLOR = '#d97706';
const INSPECTED_PIPE_COLOR = '#2563eb';

// Layout constants
const FIT_VIEW_PADDING = 0.1;
const FLOW_MIN_ZOOM = 0.1;
const FLOW_MAX_ZOOM = 2;

// MiniMap constants
const MINIMAP_SIZE = 125;
const MINIMAP_NODE_STROKE_WIDTH = 3;

type VariableWidthEdgeProps = EdgeProps;

const VariableWidthEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: VariableWidthEdgeProps) => {
  const edgeWidthConfig = useEdgeWidthConfig();
  const edgeColoring = useEdgeColoring();
  const edgePalette = useEdgeColorPalette()[0];
  const selectedNodeIds = useSelectedNodeIds();
  const selectedNodeData = useSelectedNodeData();
  const inspection = useGraphInspection();
  const highlightedNodeIds = useEffectiveHighlightedNodeIds().ids;
  const [edgeWidthField] = useSelectedEdgeWidthField();
  const [edgeColorField] = useSelectedEdgeColorField();
  const isDark = (data as { isDark?: boolean })?.isDark ?? false;
  const [tooltipPosition, setTooltipPosition] = useState<PointerPosition | null>(null);

  let strokeWidth = EDGE_STROKE_WIDTH_DEFAULT;
  if (edgeWidthConfig) {
    const v = edgeWidthConfig.values.get(id);
    if (v !== undefined) {
      const t = normalizeEdgeWidth(v, edgeWidthConfig.min, edgeWidthConfig.max);
      strokeWidth = EDGE_STROKE_WIDTH_MIN + t * EDGE_STROKE_WIDTH_RANGE;
    }
  }

  let edgeColor: string | undefined;
  let edgeDimmed = false;
  if (edgeColoring) {
    if (edgeColoring.type === 'continuous') {
      const v = edgeColoring.values.get(id);
      if (v === undefined) {
        edgeDimmed = true;
      } else {
        const t =
          edgeColoring.max > edgeColoring.min
            ? (v - edgeColoring.min) / (edgeColoring.max - edgeColoring.min)
            : FALLBACK_NORMALIZED_T;
        edgeColor = continuousColor(t, edgePalette, isDark);
      }
    } else {
      const color = edgeColoring.colorMap.get(id);
      if (!color) {
        edgeDimmed = true;
      } else {
        edgeColor = color;
      }
    }
  }

  const dimFromInteraction = shouldDimEdgeFromInteraction({
    sourceId: source,
    targetId: target,
    selectedNodeIds,
    highlightedNodeIds,
  });
  let isEdgeDimmed = edgeDimmed || dimFromInteraction;
  const renderedEdge = (data as { edge?: DAGData['edges'][number] })?.edge;
  const isBuildEdge =
    renderedEdge !== undefined &&
    isSelectedInputEdge(renderedEdge, selectedNodeData?.nodeId, selectedNodeData?.statistics);
  if (isBuildEdge) {
    edgeColor = SELECTED_INPUT_EDGE_COLOR;
    strokeWidth = Math.max(strokeWidth, EDGE_STROKE_WIDTH_MIN + 2);
  }
  const isInspectedPipe =
    renderedEdge !== undefined &&
    inspection?.kind === 'pipe' &&
    renderedEdge.sourcePortId === inspection.sourcePortId &&
    renderedEdge.targetPortId === inspection.targetPortId;
  if (isInspectedPipe) {
    edgeColor = INSPECTED_PIPE_COLOR;
    strokeWidth = Math.max(strokeWidth, EDGE_STROKE_WIDTH_MIN + 3);
    isEdgeDimmed = false;
  }

  let edgeLabelValue: string | undefined;
  const flowLabel = renderedEdge ? formatEdgeFlowLabel(renderedEdge) : null;
  const edgeTooltip = renderedEdge ? formatEdgeTooltip(renderedEdge) : '';
  if (flowLabel) {
    edgeLabelValue = flowLabel;
  } else if (edgeColoring) {
    if (edgeColoring.type === 'continuous') {
      const v = edgeColoring.values.get(id);
      if (v !== undefined) {
        edgeLabelValue = inferFieldFormatter(edgeColorField ?? '')(v);
      }
    } else {
      const v = edgeColoring.labelMap.get(id);
      if (v !== undefined) {
        edgeLabelValue = v;
      }
    }
  } else if (edgeWidthConfig) {
    const v = edgeWidthConfig.values.get(id);
    if (v !== undefined) {
      edgeLabelValue = inferFieldFormatter(edgeWidthField ?? '')(v);
    }
  }

  const arrowWidth = strokeWidth * ARROW_WIDTH_MULTIPLIER + ARROW_WIDTH_BASE;
  const arrowDepth = arrowWidth * ARROW_DEPTH_RATIO;
  const markerId = `arrow-${id}`;
  const tooltipId = `pipe-tooltip-${id}`;
  const targetYOffset = targetPosition === Position.Bottom ? arrowDepth : -arrowDepth;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY: targetY + targetYOffset,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth={arrowDepth}
          markerHeight={arrowWidth}
          refX={0}
          refY={arrowWidth / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d={`M0,0 L0,${arrowWidth} L${arrowDepth},${arrowWidth / 2} z`}
            fill={edgeColor ?? 'currentColor'}
            opacity={isEdgeDimmed ? EDGE_DIMMED_OPACITY : 1}
          />
        </marker>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: edgeColor ?? 'currentColor',
          strokeWidth,
          fill: 'none',
          opacity: isEdgeDimmed ? EDGE_DIMMED_OPACITY : 1,
          transition: `opacity ${EDGE_TRANSITION_MS}ms, stroke ${EDGE_TRANSITION_MS}ms`,
        }}
      >
        {edgeTooltip && <title>{edgeTooltip}</title>}
      </path>
      <path
        d={edgePath}
        className="react-flow__edge-interaction"
        fill="none"
        stroke="transparent"
        strokeWidth={getEdgeInteractionWidth(strokeWidth)}
        pointerEvents="stroke"
        aria-label={
          renderedEdge
            ? `Inspect pipe ${renderedEdge.sourcePortName ?? renderedEdge.sourcePortId ?? source} to ${renderedEdge.targetPortName ?? renderedEdge.targetPortId ?? target}`
            : `Inspect pipe ${source} to ${target}`
        }
        aria-describedby={tooltipPosition && edgeTooltip ? tooltipId : undefined}
        role="button"
        tabIndex={0}
        onMouseEnter={event =>
          setTooltipPosition({ clientX: event.clientX, clientY: event.clientY })
        }
        onMouseMove={event =>
          setTooltipPosition({ clientX: event.clientX, clientY: event.clientY })
        }
        onMouseLeave={() => setTooltipPosition(null)}
        onFocus={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setTooltipPosition({ clientX: bounds.left + bounds.width / 2, clientY: bounds.top });
        }}
        onBlur={() => setTooltipPosition(null)}
        onKeyDown={event => {
          if (isEdgeInspectionKey(event.key) && renderedEdge) {
            event.preventDefault();
            (data as { onInspect?: (edge: DAGData['edges'][number]) => void })?.onInspect?.(
              renderedEdge
            );
          }
        }}
      />
      {edgeLabelValue && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              opacity: isEdgeDimmed ? EDGE_DIMMED_OPACITY : 1,
              transition: `opacity ${EDGE_TRANSITION_MS}ms`,
            }}
            className="text-[10px] font-medium px-1 py-0.5 rounded bg-background/80 text-muted-foreground border border-border/50"
            onMouseEnter={event =>
              setTooltipPosition({ clientX: event.clientX, clientY: event.clientY })
            }
            onMouseMove={event =>
              setTooltipPosition({ clientX: event.clientX, clientY: event.clientY })
            }
            onMouseLeave={() => setTooltipPosition(null)}
          >
            {edgeLabelValue}
          </div>
        </EdgeLabelRenderer>
      )}
      {edgeTooltip && (
        <PointerTooltipPortal hover={tooltipPosition}>
          <pre
            id={tooltipId}
            role="tooltip"
            className="max-w-80 whitespace-pre-wrap rounded-md border bg-popover p-2 text-[10px] text-popover-foreground shadow-md"
          >
            {edgeTooltip}
          </pre>
        </PointerTooltipPortal>
      )}
    </>
  );
};

const edgeTypes = {
  smoothstep: VariableWidthEdge,
  default: VariableWidthEdge,
};

// Custom node types for different operations
const nodeTypes = {
  source: QueryPlanNode,
  scan: QueryPlanNode,
  join: QueryPlanNode,
  joinlocal: QueryPlanNode,
  joinpartition: QueryPlanNode,
  filesystemscan: QueryPlanNode,
  aggregate: QueryPlanNode,
  exchange: QueryPlanNode,
  output: QueryPlanNode,
  stage: QueryPlanNode,
  local: QueryPlanNode,
  project: QueryPlanNode,
  filter: QueryPlanNode,
  sort: QueryPlanNode,
  limit: QueryPlanNode,
  union: QueryPlanNode,
  other: QueryPlanNode,
  default: QueryPlanNode,
};

interface DAGProps {
  data: DAGData;
  height?: string;
  /** Whether dark mode is active. Passed explicitly to decouple from ThemeContext. */
  isDark: boolean;
  /** Controlled selected node IDs. When provided, overrides internal selection state. */
  selectedNodeIds?: string[];
  /** Called when node selection changes. */
  onSelectionChange?: (nodeIds: string[]) => void;
}

const FlowLayout = ({
  data,
  containerRef,
  isDark,
  selectedNodeIds: controlledSelectedNodeIds,
  onSelectionChange,
}: {
  data: DAGData;
  containerRef: RefObject<HTMLDivElement | null>;
  isDark: boolean;
  selectedNodeIds?: string[];
  onSelectionChange?: (nodeIds: string[]) => void;
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<QueryPlanNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const setSelectedNodeIds = useSetSelectedNodeIds();
  const setSelectedOperatorLabel = useSetSelectedOperatorLabel();
  const updateOperatorSelection = useOperatorSelectionActions();
  const setDagDisplayedNodeIds = useSetDagDisplayedNodeIds();
  const setSelectedNodeData = useSetSelectedNodeData();
  const requestedPipeInspection = useRequestedPipeInspection();
  const setGraphInspection = useSetGraphInspection();
  const selectedNodeIds = useSelectedNodeIds();
  const [layoutDirection] = useSelectedDagLayoutDirection();
  const dataFlowEnabled = useDataFlowEnabled();
  const dataFlowMeta = useDataFlowMeta();
  // Stable boolean: only flips on availability/toggle, not on zoom refetches,
  // so toggling the overlay relayouts exactly once.
  const flowBarVisible = dataFlowEnabled && dataFlowMeta != null;
  const hasUserInteracted = useRef(false);
  const hydratedNodeIdsKey = useMemo(
    () =>
      [...(controlledSelectedNodeIds === undefined ? selectedNodeIds : controlledSelectedNodeIds)]
        .sort()
        .join('\0'),
    [controlledSelectedNodeIds, selectedNodeIds]
  );

  useEffect(() => {
    const operatorIds = new Set(hydratedNodeIdsKey === '' ? [] : hydratedNodeIdsKey.split('\0'));
    const resolved = resolveInspectedNodeSelections(data.nodes, operatorIds);
    if (controlledSelectedNodeIds !== undefined) {
      updateOperatorSelection({
        type: 'replace',
        selections: [
          ...resolved.selections,
          ...[...resolved.unresolvedOperatorIds].map(selectionId => ({
            selectionId,
            label: data.nodes.find(node => node.id === selectionId)?.label ?? selectionId,
            operatorIds: new Set([selectionId]),
          })),
        ],
      });
      return;
    }
    updateOperatorSelection({ type: 'hydrate', selections: resolved.selections });
  }, [controlledSelectedNodeIds, data.nodes, hydratedNodeIdsKey, updateOperatorSelection]);

  // Publish the set of operator IDs visible in this DAG so other consumers
  // (effective highlight/heatmap atoms) can decide whether a hover-driven
  // dim is meaningful for what's currently on screen.
  useEffect(() => {
    setDagDisplayedNodeIds(new Set(data.nodes.map(n => n.id)));
    return () => {
      setDagDisplayedNodeIds(new Set());
    };
  }, [data.nodes, setDagDisplayedNodeIds]);

  const handleMoveStart = useCallback<OnMoveStart>(event => {
    if (event !== null) {
      hasUserInteracted.current = true;
    }
  }, []);

  const operatorColorMap = useMemo(
    () => buildOperatorColorMap(data.nodes.map(n => n.type)),
    [data.nodes]
  );

  const getSelectionIds = useCallback((node: Node<QueryPlanNodeData>): string[] => {
    const relatedOperatorIds = node.data.metadata?.relatedOperatorIds ?? [];
    return relatedOperatorIds.length > 0 ? [...relatedOperatorIds, node.id] : [node.id];
  }, []);

  const statQuantitySpecs = useMemo((): Record<string, QuantitySpec> => {
    if (!data.quantitySpecs) {
      return {};
    }
    const result: Record<string, QuantitySpec> = {};
    for (const node of data.nodes) {
      for (const stat of parseCustomStatistics(node.metadata?.rawNode)) {
        if (stat.quantity && !(stat.key in result)) {
          const spec = data.quantitySpecs[stat.quantity];
          if (spec) {
            result[stat.key] = spec;
          }
        }
      }
    }
    return result;
  }, [data.nodes, data.quantitySpecs]);

  const inspectEdge = useCallback(
    (edge: DAGData['edges'][number]) => {
      const pipe = inspectPipe(data.nodes, edge);
      if (pipe) {
        setGraphInspection(pipe);
      }
    },
    [data.nodes, setGraphInspection]
  );

  useEffect(() => {
    if (!requestedPipeInspection) {
      return;
    }
    const pipe = resolvePipeInspection(data.nodes, data.edges, requestedPipeInspection);
    setGraphInspection(pipe);
  }, [data.edges, data.nodes, requestedPipeInspection, setGraphInspection]);

  // Convert DAGData to ReactFlow format
  const convertToReactFlow = useCallback(() => {
    // Determine which nodes have incoming/outgoing edges
    const nodesWithIncoming = new Set(data.edges.map(e => e.target));
    const nodesWithOutgoing = new Set(data.edges.map(e => e.source));

    const flowNodes: Node<QueryPlanNodeData>[] = data.nodes.map(node => {
      return {
        id: node.id,
        type: node.type,
        data: {
          nodeId: node.id,
          label: node.label,
          operationType: node.type,
          metadata: node.metadata as QueryPlanNodeData['metadata'],
          hasIncoming: nodesWithIncoming.has(node.id),
          hasOutgoing: nodesWithOutgoing.has(node.id),
          layoutDirection,
          isDark,
          baseColor: operatorColorMap.get(node.type.toLowerCase()),
          flowBarVisible,
          quantitySpecs: data.quantitySpecs,
        },
        style: {
          width: NODE_LAYOUT_WIDTH,
          background: 'transparent',
          boxShadow: 'none',
          border: 0,
          padding: 0,
        },
        position: { x: 0, y: 0 }, // Will be set by layout
      };
    });

    const flowEdges: Edge[] = data.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      // Pass isDark down to edge components via data
      data: { isDark, edge, onInspect: inspectEdge },
    }));

    return { flowNodes, flowEdges };
  }, [data, isDark, operatorColorMap, layoutDirection, flowBarVisible, inspectEdge]);

  const handleEdgeClick = useCallback(
    (_event: MouseEvent, edge: Edge): void => {
      const renderedEdge = (edge.data as { edge?: DAGData['edges'][number] })?.edge;
      if (renderedEdge) {
        inspectEdge(renderedEdge);
      }
    },
    [inspectEdge]
  );

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: Node<QueryPlanNodeData>): void => {
      if (selectedNodeIds.has(node.id)) {
        setSelectedNodeIds(new Set());
        setSelectedOperatorLabel(null);
        setSelectedNodeData(null);
        onSelectionChange?.([]);
      } else {
        const selectionIds = getSelectionIds(node);
        const newSet = new Set(selectionIds);
        setSelectedNodeIds(newSet);
        setSelectedOperatorLabel(node.data.label);
        setSelectedNodeData({
          selectionId: node.id,
          data: {
            nodeId: node.id,
            label: node.data.label,
            operationType: node.data.operationType,
            statistics: parseCustomStatistics(node.data.metadata?.rawNode),
            observations: parseOperatorObservations(node.data.metadata?.rawNode),
            ports: node.data.metadata?.ports?.map(port => ({
              id: port.id,
              ...(port.instance_name ? { name: port.instance_name } : {}),
              statistics: parsePortStatistics(port),
            })),
            relatedOperators: node.data.metadata?.relatedOperators?.map(operator => ({
              nodeId: operator.id,
              label: operator.instance_name ?? operator.operator_type_name ?? 'Operator',
              operationType: operator.operator_type_name?.toLowerCase() ?? 'operator',
              statistics: parseCustomStatistics(operator),
              observations: parseOperatorObservations(operator),
            })),
          },
        });
        onSelectionChange?.(selectionIds);
      }
    },
    [
      getSelectionIds,
      selectedNodeIds,
      setSelectedNodeIds,
      setSelectedOperatorLabel,
      setSelectedNodeData,
      onSelectionChange,
    ]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedOperatorLabel(null);
    setSelectedNodeData(null);
  }, [setSelectedNodeIds, setSelectedOperatorLabel, setSelectedNodeData]);

  // Re-fit view when the react-flow container is resized, but only if the user
  // hasn't interacted with the chart (to maintain any focus states applied)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (nodes.length > 0 && !hasUserInteracted.current) {
        fitView({ padding: FIT_VIEW_PADDING, minZoom: FLOW_MIN_ZOOM });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, fitView, nodes.length]);

  // Calculate and apply layout
  useLayoutEffect(() => {
    hasUserInteracted.current = false;
    // calculateLayout is async: rapid dependency changes (e.g. flowBarVisible
    // toggles) can interleave calls, so discard results from stale runs
    // instead of letting them overwrite a newer layout.
    let cancelled = false;

    const applyLayout = async () => {
      const { flowNodes, flowEdges } = convertToReactFlow();
      const layoutResult = await calculateLayout(
        flowNodes,
        flowEdges,
        layoutDirection,
        NODE_LAYOUT_HEIGHT + (flowBarVisible ? FLOW_BAR_HEIGHT : 0)
      );
      if (cancelled) {
        return;
      }

      setNodes(layoutResult.nodes);
      setEdges(layoutResult.edges);

      // Fit view after layout
      setTimeout(() => fitView({ padding: FIT_VIEW_PADDING, minZoom: FLOW_MIN_ZOOM }), 0);
    };

    applyLayout();
    return () => {
      cancelled = true;
    };
  }, [data, convertToReactFlow, fitView, setNodes, setEdges, layoutDirection, flowBarVisible]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onPaneClick={handlePaneClick}
      onMoveStart={handleMoveStart}
      proOptions={{ hideAttribution: true }}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={FLOW_MIN_ZOOM}
      maxZoom={FLOW_MAX_ZOOM}
      defaultEdgeOptions={{ type: 'smoothstep' }}
    >
      <Background />
      <DAGLegend isDark={isDark} statQuantitySpecs={statQuantitySpecs} />
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={MINIMAP_NODE_STROKE_WIDTH}
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE, background: 'hsl(var(--card))' }}
        maskColor="hsl(var(--muted) / 0.7)"
        nodeColor={(node: Node<QueryPlanNodeData>) =>
          (node.data as QueryPlanNodeData).baseColor ??
          getOperationTypeColor((node.data as QueryPlanNodeData).operationType)
        }
      />
    </ReactFlow>
  );
};

/** ReactFlow-based DAG visualization with ELK layout, edge styling, and node selection. */
export const DAGChart = ({
  data,
  height = '100%',
  isDark,
  selectedNodeIds,
  onSelectionChange,
}: DAGProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <ReactFlowProvider>
        <FlowLayout
          data={data}
          containerRef={containerRef}
          isDark={isDark}
          selectedNodeIds={selectedNodeIds}
          onSelectionChange={onSelectionChange}
        />
      </ReactFlowProvider>
    </div>
  );
};
