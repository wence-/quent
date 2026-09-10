// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { StatValue } from './dagTypes';

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
  statistics: Array<{ key: string; value: StatValue; quantity?: string }>;
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
  statistics: Array<{ key: string; value: StatValue }>;
}

export interface SelectedOperatorGroupData extends SelectedOperatorData {
  relatedOperators?: SelectedOperatorData[];
}
