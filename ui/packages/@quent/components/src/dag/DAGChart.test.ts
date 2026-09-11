// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { DAGEdge, DAGNode } from '@quent/utils';
import { getEdgeInteractionWidth, isEdgeInspectionKey } from './edgeInteraction';
import { resolveInspectedNodeData, resolveInspectedNodeSelections } from './dagSelection';

const NODES: DAGNode[] = [
  {
    id: 'logical',
    label: 'Logical join',
    type: 'join',
    metadata: { relatedOperatorIds: ['physical-1', 'physical-2'] },
  },
  {
    id: 'other',
    label: 'Other operator',
    type: 'scan',
  },
];

describe('resolveInspectedNodeData', () => {
  it('retains structural port identity and statistics for details', () => {
    const node: DAGNode = {
      id: 'join',
      label: 'Join',
      type: 'join',
      metadata: {
        ports: [
          {
            id: 'port-1',
            operator_id: 'join',
            instance_name: 'input_0',
            statistics: {
              information: [
                {
                  heading: 'Volume',
                  items: [{ key: 'rows', value: { UInt64: 42 }, quantity: null }],
                },
              ],
            },
          },
        ],
      },
    };

    const edges: DAGEdge[] = [
      {
        id: 'pipe-1',
        source: 'scan',
        target: 'join',
        sourcePortId: 'scan-output',
        targetPortId: 'port-1',
      },
    ];

    expect(resolveInspectedNodeData([node], new Set(['join']), edges)?.ports).toEqual([
      {
        id: 'port-1',
        name: 'input_0',
        information: [{ heading: 'Volume', items: [{ key: 'rows', value: 42 }] }],
        connectedPipe: { sourcePortId: 'scan-output', targetPortId: 'port-1' },
      },
    ]);
  });

  it('does not guess a connection for an unconnected or ambiguous port', () => {
    const node: DAGNode = {
      id: 'join',
      label: 'Join',
      type: 'join',
      metadata: {
        ports: [{ id: 'port-1', operator_id: 'join', instance_name: 'input_0' }],
      },
    };
    const repeatedEdges: DAGEdge[] = [
      {
        id: 'pipe-1',
        source: 'left',
        target: 'join',
        sourcePortId: 'left-output',
        targetPortId: 'port-1',
      },
      {
        id: 'pipe-2',
        source: 'right',
        target: 'join',
        sourcePortId: 'right-output',
        targetPortId: 'port-1',
      },
    ];

    expect(resolveInspectedNodeData([node], new Set(['join']))?.ports?.[0].connectedPipe).toBe(
      undefined
    );
    expect(
      resolveInspectedNodeData([node], new Set(['join']), repeatedEdges)?.ports?.[0].connectedPipe
    ).toBe(undefined);
  });

  it('resolves the primary operator from a hydrated grouped selection', () => {
    expect(
      resolveInspectedNodeData(NODES, new Set(['logical', 'physical-1', 'physical-2']))
    ).toMatchObject({
      nodeId: 'logical',
      label: 'Logical join',
      operationType: 'join',
    });
  });

  it('does not inspect an ambiguous selection', () => {
    expect(resolveInspectedNodeData(NODES, new Set(['logical', 'other']))).toBeNull();
  });

  it('reconstructs multiple physical and higher-level selections', () => {
    const resolved = resolveInspectedNodeSelections(
      NODES,
      new Set(['logical', 'physical-1', 'physical-2', 'other'])
    );

    expect(resolved.selections).toMatchObject([
      {
        selectionId: 'logical',
        label: 'Logical join',
        operatorIds: new Set(['logical', 'physical-1', 'physical-2']),
      },
      {
        selectionId: 'other',
        label: 'Other operator',
        operatorIds: new Set(['other']),
      },
    ]);
    expect(resolved.unresolvedOperatorIds).toEqual(new Set());
  });

  it('preserves IDs until matching DAG data is available', () => {
    const selectedIds = new Set(['logical', 'physical-1', 'physical-2', 'unknown']);

    const beforeData = resolveInspectedNodeSelections([], selectedIds);
    expect(beforeData.selections).toEqual([]);
    expect(beforeData.unresolvedOperatorIds).toEqual(selectedIds);

    const afterData = resolveInspectedNodeSelections(NODES, selectedIds);
    expect(afterData.selections.map(selection => selection.selectionId)).toEqual(['logical']);
    expect(afterData.unresolvedOperatorIds).toEqual(new Set(['unknown']));
  });
});

describe('edge interaction affordance', () => {
  it('keeps thin edges easy to acquire without constraining visible widths', () => {
    expect(getEdgeInteractionWidth(1.5)).toBe(16);
    expect(getEdgeInteractionWidth(25)).toBe(25);
  });

  it('supports standard keyboard activation keys', () => {
    expect(isEdgeInspectionKey('Enter')).toBe(true);
    expect(isEdgeInspectionKey(' ')).toBe(true);
    expect(isEdgeInspectionKey('Escape')).toBe(false);
  });
});
