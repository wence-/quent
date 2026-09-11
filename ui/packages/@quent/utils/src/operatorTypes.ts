// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { InspectedInformationGroup, StatValue } from './dagTypes';

export interface OperatorSelection {
  readonly label: string;
  readonly operatorIds: ReadonlySet<string>;
}

export interface OperatorSelectionInput extends OperatorSelection {
  readonly selectionId: string;
}

export interface OperatorSelectionState {
  readonly selections: ReadonlyMap<string, OperatorSelection>;
  readonly activeId: string | null;
}

export interface InspectedOperatorData {
  nodeId: string;
  label: string;
  operationType: string;
  information: InspectedInformationGroup[];
  observations: InspectedOperatorObservation[];
  ports?: InspectedPortData[];
}

export interface InspectedOperatorObservation {
  timeSeconds: number;
  kind: string;
  attributes: Array<{ key: string; value: StatValue }>;
}

export interface InspectedPortData {
  id: string;
  name?: string;
  information: InspectedInformationGroup[];
  connectedPipe?: PipeInspectionKey;
}

export interface InspectedNodeData extends InspectedOperatorData {
  relatedOperators?: InspectedOperatorData[];
}

export interface PipeInspectionKey {
  sourcePortId: string;
  targetPortId: string;
}

export interface InspectedPipeEndpoint {
  operatorId: string;
  operatorLabel: string;
  port: InspectedPortData;
}

export interface OperatorInspection {
  kind: 'operator';
  selectionId: string;
  operator: InspectedNodeData;
}

export interface PipeInspection extends PipeInspectionKey {
  kind: 'pipe';
  source: InspectedPipeEndpoint;
  target: InspectedPipeEndpoint;
}

export type InspectedGraphItem = OperatorInspection | PipeInspection;

export function informationItems(
  groups: readonly InspectedInformationGroup[]
): InspectedInformationGroup['items'] {
  return groups.flatMap(group => group.items);
}

export function findInformationItem(
  groups: readonly InspectedInformationGroup[],
  key: string
): InspectedInformationGroup['items'][number] | undefined {
  for (const group of groups) {
    const item = group.items.find(candidate => candidate.key === key);
    if (item) {
      return item;
    }
  }
  return undefined;
}
