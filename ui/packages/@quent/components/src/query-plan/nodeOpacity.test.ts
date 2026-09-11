// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { getNodeOpacityClass } from './nodeOpacity';

describe('getNodeOpacityClass', () => {
  it('keeps every selected node highlighted during a DAG hover', () => {
    expect(
      getNodeOpacityClass({
        hoveredStatValues: null,
        highlightedNodeIds: new Set(['hovered']),
        operatorId: 'selected',
        isDimmed: false,
        isSelected: true,
      })
    ).toBe('opacity-100');
  });

  it('dims nodes that are neither selected nor hovered', () => {
    expect(
      getNodeOpacityClass({
        hoveredStatValues: null,
        highlightedNodeIds: new Set(['hovered']),
        operatorId: 'other',
        isDimmed: true,
        isSelected: false,
      })
    ).toBe('opacity-35');
  });

  it('lets pipe inspection override the previous operator selection', () => {
    expect(
      getNodeOpacityClass({
        hoveredStatValues: null,
        highlightedNodeIds: new Set(['previously-selected']),
        operatorId: 'previously-selected',
        isDimmed: false,
        isSelected: true,
        inspectionFocusedNodeIds: new Set(['source', 'target']),
      })
    ).toBe('opacity-35');
  });

  it('keeps only the hovered endpoint prominent when endpoint focus narrows', () => {
    expect(
      getNodeOpacityClass({
        hoveredStatValues: null,
        highlightedNodeIds: new Set(['source']),
        operatorId: 'target',
        isDimmed: false,
        isSelected: false,
        inspectionFocusedNodeIds: new Set(['source']),
      })
    ).toBe('opacity-35');
  });
});
