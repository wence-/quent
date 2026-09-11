// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { inspectPipe, resolvePipeInspection } from './dagSelection';

const nodes = [
  { id: 'source', label: 'Source', type: 'scan' },
  { id: 'target', label: 'Target', type: 'zip' },
];

const edges = [
  {
    id: 'edge-0',
    source: 'source',
    target: 'target',
    sourcePortId: 'source-port-0',
    targetPortId: 'target-port-0',
    sourcePortName: 'output_0',
    targetPortName: 'input_0',
    portInformation: [{ heading: 'Volume', items: [{ key: 'rows', value: 10 }] }],
    targetPortInformation: [{ heading: 'Volume', items: [{ key: 'rows', value: 10 }] }],
  },
  {
    id: 'edge-1',
    source: 'source',
    target: 'target',
    sourcePortId: 'source-port-1',
    targetPortId: 'target-port-1',
    portInformation: [{ heading: 'Volume', items: [{ key: 'rows', value: 20 }] }],
    targetPortInformation: [{ heading: 'Volume', items: [{ key: 'rows', value: 19 }] }],
  },
];

describe('pipe inspection', () => {
  it('retains endpoint identity and evidence separately', () => {
    expect(inspectPipe(nodes, edges[0])).toEqual({
      kind: 'pipe',
      sourcePortId: 'source-port-0',
      targetPortId: 'target-port-0',
      source: {
        operatorId: 'source',
        operatorLabel: 'Source',
        port: {
          id: 'source-port-0',
          name: 'output_0',
          information: [{ heading: 'Volume', items: [{ key: 'rows', value: 10 }] }],
        },
      },
      target: {
        operatorId: 'target',
        operatorLabel: 'Target',
        port: {
          id: 'target-port-0',
          name: 'input_0',
          information: [{ heading: 'Volume', items: [{ key: 'rows', value: 10 }] }],
        },
      },
    });
  });

  it('distinguishes repeated operator-pair edges by both port ids', () => {
    const inspection = resolvePipeInspection(nodes, edges, {
      sourcePortId: 'source-port-1',
      targetPortId: 'target-port-1',
    });
    expect(inspection?.source.port.information).toEqual([
      { heading: 'Volume', items: [{ key: 'rows', value: 20 }] },
    ]);
    expect(inspection?.target.port.information).toEqual([
      { heading: 'Volume', items: [{ key: 'rows', value: 19 }] },
    ]);
  });

  it('does not guess when an endpoint or requested edge is absent', () => {
    expect(inspectPipe(nodes, { ...edges[0], targetPortId: undefined })).toBeNull();
    expect(
      resolvePipeInspection(nodes, edges, {
        sourcePortId: 'source-port-0',
        targetPortId: 'missing',
      })
    ).toBeNull();
  });
});
