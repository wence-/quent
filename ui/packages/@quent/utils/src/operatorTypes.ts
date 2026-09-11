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
}

export interface SelectedOperatorData {
  nodeId: string;
  label: string;
  operationType: string;
  information: InspectedInformationGroup[];
  observations?: SelectedOperatorObservation[];
  ports?: SelectedOperatorPortData[];
}

export interface SelectedOperatorObservation {
  timeSeconds: number;
  kind: string;
  attributes: Array<{ key: string; value: StatValue }>;
}

export interface SelectedOperatorPortData {
  id: string;
  name?: string;
  information: InspectedInformationGroup[];
}

export interface SelectedOperatorGroupData extends SelectedOperatorData {
  relatedOperators?: SelectedOperatorData[];
}

export interface PipeInspectionKey {
  sourcePortId: string;
  targetPortId: string;
}

export interface InspectedPipeEndpoint {
  operatorId: string;
  operatorLabel: string;
  port: SelectedOperatorPortData;
}

export interface OperatorInspection {
  kind: 'operator';
  selectionId: string;
  operator: SelectedOperatorGroupData;
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
