// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  resolveOperatorSelectionCandidates,
  type DAGNode,
  type DAGEdge,
  type InspectedNodeData,
  type PipeInspection,
  type PipeInspectionKey,
} from '@quent/utils';
import {
  parseOperatorInformation,
  parseOperatorObservations,
  parsePortInformation,
} from '../lib/queryBundle.utils';
import type { QueryPlanNodeData } from '../query-plan/QueryPlanNode';

export interface ResolvedOperatorSelection {
  selectionId: string;
  label: string;
  operatorIds: ReadonlySet<string>;
  inspectedData: InspectedNodeData;
}

export function inspectPipe(nodes: readonly DAGNode[], edge: DAGEdge): PipeInspection | null {
  if (!edge.sourcePortId || !edge.targetPortId) {
    return null;
  }
  const sourceNode = nodes.find(node => node.id === edge.source);
  const targetNode = nodes.find(node => node.id === edge.target);
  if (!sourceNode || !targetNode) {
    return null;
  }

  return {
    kind: 'pipe',
    sourcePortId: edge.sourcePortId,
    targetPortId: edge.targetPortId,
    source: {
      operatorId: sourceNode.id,
      operatorLabel: sourceNode.label,
      port: {
        id: edge.sourcePortId,
        ...(edge.sourcePortName ? { name: edge.sourcePortName } : {}),
        information: edge.portInformation ?? [],
      },
    },
    target: {
      operatorId: targetNode.id,
      operatorLabel: targetNode.label,
      port: {
        id: edge.targetPortId,
        ...(edge.targetPortName ? { name: edge.targetPortName } : {}),
        information: edge.targetPortInformation ?? [],
      },
    },
  };
}

export function resolvePipeInspection(
  nodes: readonly DAGNode[],
  edges: readonly DAGEdge[],
  key: PipeInspectionKey
): PipeInspection | null {
  const edge = edges.find(
    candidate =>
      candidate.sourcePortId === key.sourcePortId && candidate.targetPortId === key.targetPortId
  );
  return edge ? inspectPipe(nodes, edge) : null;
}

export interface ResolvedOperatorSelections {
  selections: ResolvedOperatorSelection[];
  unresolvedOperatorIds: ReadonlySet<string>;
}

function getOperatorIds(node: DAGNode): Set<string> {
  const metadata = node.metadata as QueryPlanNodeData['metadata'];
  return new Set([node.id, ...(metadata?.relatedOperatorIds ?? [])]);
}

function resolveConnectedPipe(
  edges: readonly DAGEdge[],
  portId: string
): PipeInspectionKey | undefined {
  const matches = edges.filter(
    edge => edge.sourcePortId === portId || edge.targetPortId === portId
  );
  if (matches.length !== 1) {
    return undefined;
  }
  const [edge] = matches;
  return edge.sourcePortId && edge.targetPortId
    ? { sourcePortId: edge.sourcePortId, targetPortId: edge.targetPortId }
    : undefined;
}

function inspectNode(node: DAGNode, edges: readonly DAGEdge[]): InspectedNodeData {
  const metadata = node.metadata as QueryPlanNodeData['metadata'];
  return {
    nodeId: node.id,
    label: node.label,
    operationType: node.type,
    information: parseOperatorInformation(metadata?.rawNode),
    observations: parseOperatorObservations(metadata?.rawNode),
    ports: metadata?.ports?.map(port => {
      const connectedPipe = resolveConnectedPipe(edges, port.id);
      return {
        id: port.id,
        ...(port.instance_name ? { name: port.instance_name } : {}),
        information: parsePortInformation(port),
        ...(connectedPipe ? { connectedPipe } : {}),
      };
    }),
    relatedOperators: metadata?.relatedOperators?.map(operator => ({
      nodeId: operator.id,
      label: operator.instance_name ?? operator.operator_type_name ?? 'Operator',
      operationType: operator.operator_type_name?.toLowerCase() ?? 'operator',
      information: parseOperatorInformation(operator),
      observations: parseOperatorObservations(operator),
    })),
  };
}

export function resolveInspectedNodeSelections(
  nodes: readonly DAGNode[],
  selectedNodeIds: ReadonlySet<string>,
  edges: readonly DAGEdge[] = []
): ResolvedOperatorSelections {
  const candidates = nodes.map(node => ({
    selectionId: node.id,
    label: node.label,
    operatorIds: getOperatorIds(node),
    inspectedData: inspectNode(node, edges),
  }));

  return resolveOperatorSelectionCandidates(candidates, selectedNodeIds);
}

export function resolveInspectedNodeData(
  nodes: readonly DAGNode[],
  selectedNodeIds: ReadonlySet<string>,
  edges: readonly DAGEdge[] = []
): InspectedNodeData | null {
  const resolved = resolveInspectedNodeSelections(nodes, selectedNodeIds, edges);
  if (resolved.selections.length !== 1 || resolved.unresolvedOperatorIds.size > 0) {
    return null;
  }
  return resolved.selections[0].inspectedData;
}
