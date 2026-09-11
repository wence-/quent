// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { DAGEdge } from '@quent/utils';
import {
  formatEdgeFlowLabel,
  formatEdgeTooltip,
  formatOperatorFlowSummary,
  isSelectedInputEdge,
  normalizeEdgeWidth,
} from './flowPresentation';

const EDGE: DAGEdge = {
  id: 'edge',
  source: 'scan',
  target: 'join',
  sourcePortId: 'source-port',
  targetPortId: 'target-port',
  sourcePortName: 'output_0',
  targetPortName: 'input_1',
  portInformation: [
    {
      heading: 'Volume',
      items: [
        { key: 'rows', value: 1500 },
        { key: 'bytes', value: 1048576n },
        { key: 'bytes_unknown_messages', value: 2 },
      ],
    },
  ],
  targetPortInformation: [{ heading: 'Volume', items: [{ key: 'rows', value: 1499 }] }],
};

describe('flow presentation', () => {
  it('formats compact edge rows and partial bytes', () => {
    expect(formatEdgeFlowLabel(EDGE)).toBe('1.5k · 1.00 MiB +?');
  });

  it('keeps missing statistics distinct from observed zero', () => {
    expect(formatEdgeFlowLabel({ ...EDGE, portInformation: [] })).toBeNull();
    expect(
      formatEdgeFlowLabel({
        ...EDGE,
        portInformation: [{ heading: 'Volume', items: [{ key: 'bytes', value: 0 }] }],
      })
    ).toBe('0 B');
  });

  it('shows both structural endpoints in the edge tooltip', () => {
    const tooltip = formatEdgeTooltip(EDGE);
    expect(tooltip).toContain('output_0 (source-port)');
    expect(tooltip).toContain('input_1 (target-port)');
    expect(tooltip).toContain('Volume');
    expect(tooltip).toContain('rows: 1.5k');
    expect(tooltip).toContain('bytes_unknown_messages: 2');
  });

  it('log-scales and clamps edge widths', () => {
    expect(normalizeEdgeWidth(0, 0, 100)).toBe(0);
    expect(normalizeEdgeWidth(10, 0, 100)).toBeCloseTo(Math.log1p(10) / Math.log1p(100));
    expect(normalizeEdgeWidth(200, 0, 100)).toBe(1);
    expect(normalizeEdgeWidth(7, 7, 7)).toBe(0.5);
  });

  it('matches the selected structural Join input', () => {
    expect(
      isSelectedInputEdge(EDGE, 'join', [
        {
          heading: 'Join',
          items: [{ key: 'selected_input_port_id', value: 'target-port' }],
        },
      ])
    ).toBe(true);
    expect(
      isSelectedInputEdge(EDGE, 'join', [
        { heading: 'Join', items: [{ key: 'join_build_input_index', value: 1 }] },
      ])
    ).toBe(false);
    expect(isSelectedInputEdge(EDGE, 'other', [])).toBe(false);
  });

  it('formats canonical operator aggregates without inventing absent directions', () => {
    expect(
      formatOperatorFlowSummary([
        {
          heading: 'Flow',
          items: [
            { key: 'output_rows', value: 20 },
            { key: 'output_bytes', value: 2048 },
            { key: 'output_rows_unknown_messages', value: 1 },
          ],
        },
      ])
    ).toEqual(['Out 20 +? · 2.00 KiB']);
  });
});
