// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { shouldDimEdgeFromInteraction } from './edgeOpacity';

describe('shouldDimEdgeFromInteraction', () => {
  it('dims an edge that is neither selected nor highlighted', () => {
    expect(
      shouldDimEdgeFromInteraction({
        sourceId: 'other-source',
        targetId: 'other-target',
        selectedNodeIds: new Set(['selected']),
        highlightedNodeIds: new Set(['highlighted']),
      })
    ).toBe(true);
  });

  it('keeps an edge touching a selected node visible during a highlight elsewhere', () => {
    expect(
      shouldDimEdgeFromInteraction({
        sourceId: 'selected',
        targetId: 'other',
        selectedNodeIds: new Set(['selected']),
        highlightedNodeIds: new Set(['highlighted']),
      })
    ).toBe(false);
  });

  it('dims every other edge while inspecting a pipe, including selected-node edges', () => {
    expect(
      shouldDimEdgeFromInteraction({
        sourceId: 'selected',
        targetId: 'other',
        selectedNodeIds: new Set(['selected']),
        highlightedNodeIds: new Set(['selected']),
        pipeInspectionActive: true,
        isInspectedPipe: false,
      })
    ).toBe(true);
  });

  it('keeps the inspected pipe visible regardless of the previous selection', () => {
    expect(
      shouldDimEdgeFromInteraction({
        sourceId: 'source',
        targetId: 'target',
        selectedNodeIds: new Set(['other']),
        highlightedNodeIds: new Set(['other']),
        pipeInspectionActive: true,
        isInspectedPipe: true,
      })
    ).toBe(false);
  });
});
