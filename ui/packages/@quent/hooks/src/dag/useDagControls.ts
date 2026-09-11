// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type {
  DAGNode,
  DAGEdge,
  NodeColoring,
  EdgeWidthConfig,
  EdgeColoring,
  InspectedInformationGroup,
  PaletteTheme,
} from '@quent/utils';
import {
  selectedColorField,
  nodeColoringAtom,
  selectedEdgeWidthFieldAtom,
  edgeWidthConfigAtom,
  selectedEdgeColorFieldAtom,
  edgeColoringAtom,
} from '../atoms/dagControls';

// Computation functions injected to avoid circular dep with @quent/components
type ComputeNodeColoringFn = (
  nodes: DAGNode[],
  field: string | null,
  theme: PaletteTheme
) => NodeColoring;
type ComputeEdgeWidthConfigFn = (edges: DAGEdge[], field: string | null) => EdgeWidthConfig;
type ComputeEdgeColoringFn = (
  edges: DAGEdge[],
  field: string | null,
  theme: PaletteTheme
) => EdgeColoring;
type ParseOperatorInformationFn = (rawNode: unknown) => InspectedInformationGroup[];

export function useDagNodeColoring(
  nodes: DAGNode[],
  computeNodeColoring: ComputeNodeColoringFn,
  isDark: boolean
) {
  const selectedField = useAtomValue(selectedColorField);
  const setNodeColoring = useSetAtom(nodeColoringAtom);
  const paletteTheme: PaletteTheme = isDark ? 'dark' : 'light';
  const coloring = useMemo(
    () => computeNodeColoring(nodes, selectedField, paletteTheme),
    [nodes, selectedField, paletteTheme, computeNodeColoring]
  );
  useEffect(() => {
    setNodeColoring(coloring);
  }, [coloring, setNodeColoring]);
}

export function useDagEdgeWidthConfig(
  edges: DAGEdge[],
  computeEdgeWidthConfig: ComputeEdgeWidthConfigFn
) {
  const selectedEdgeWidthField = useAtomValue(selectedEdgeWidthFieldAtom);
  const setEdgeWidthConfig = useSetAtom(edgeWidthConfigAtom);
  const config = useMemo(
    () => computeEdgeWidthConfig(edges, selectedEdgeWidthField),
    [edges, selectedEdgeWidthField, computeEdgeWidthConfig]
  );
  useEffect(() => {
    setEdgeWidthConfig(config);
  }, [config, setEdgeWidthConfig]);
}

export function useDagEdgeColoring(
  edges: DAGEdge[],
  computeEdgeColoring: ComputeEdgeColoringFn,
  isDark: boolean
) {
  const selectedField = useAtomValue(selectedEdgeColorFieldAtom);
  const setEdgeColoring = useSetAtom(edgeColoringAtom);
  const paletteTheme: PaletteTheme = isDark ? 'dark' : 'light';
  const coloring = useMemo(
    () => computeEdgeColoring(edges, selectedField, paletteTheme),
    [edges, selectedField, paletteTheme, computeEdgeColoring]
  );
  useEffect(() => {
    setEdgeColoring(coloring);
  }, [coloring, setEdgeColoring]);
}

export function useOperatorStatFields(
  nodes: DAGNode[],
  parseOperatorInformation: ParseOperatorInformationFn
): string[] {
  return useMemo(
    () => [
      ...new Set(
        nodes.flatMap(n =>
          parseOperatorInformation(n.metadata?.rawNode).flatMap(group =>
            group.items.map(item => item.key)
          )
        )
      ),
    ],
    [nodes, parseOperatorInformation]
  );
}

export function usePortStatFields(edges: DAGEdge[]): string[] {
  return useMemo(
    () => [
      ...new Set(
        edges.flatMap(e =>
          (e.portInformation ?? []).flatMap(group => group.items.map(item => item.key))
        )
      ),
    ],
    [edges]
  );
}
