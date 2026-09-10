// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { isNumericValue, type StatValue } from '@quent/utils';

export type PresentedStatistic = { key: string; value: StatValue; quantity?: string };
export type OperatorStatisticSection = 'Flow' | 'Decision' | 'Algorithm' | 'Execution';

const FLOW_FIELDS = new Set([
  'input_messages',
  'output_messages',
  'input_rows',
  'output_rows',
  'input_rows_unknown_messages',
  'output_rows_unknown_messages',
  'input_bytes',
  'output_bytes',
  'input_bytes_unknown_messages',
  'output_bytes_unknown_messages',
  'input_ports',
  'output_ports',
  'input_active_lanes',
  'output_active_lanes',
  'input_rows_lane_max',
  'output_rows_lane_max',
  'input_bytes_lane_max',
  'output_bytes_lane_max',
]);

function numeric(stats: readonly PresentedStatistic[], key: string): number | bigint | null {
  const value = stats.find(stat => stat.key === key)?.value;
  return value != null && isNumericValue(value) ? value : null;
}

function isComplete(stats: readonly PresentedStatistic[], direction: 'input' | 'output'): boolean {
  return ['rows', 'bytes'].every(measure => {
    const unknown = numeric(stats, `${direction}_${measure}_unknown_messages`);
    return unknown === 0 || unknown === 0n;
  });
}

function ratio(numerator: number | bigint, denominator: number | bigint): number | null {
  const denominatorNumber = Number(denominator);
  return denominatorNumber === 0 ? null : Number(numerator) / denominatorNumber;
}

export function deriveFlowStatistics(stats: readonly PresentedStatistic[]): PresentedStatistic[] {
  const derived: PresentedStatistic[] = [];
  const inputRows = numeric(stats, 'input_rows');
  const outputRows = numeric(stats, 'output_rows');
  const inputBytes = numeric(stats, 'input_bytes');
  const outputBytes = numeric(stats, 'output_bytes');
  const completeInput = isComplete(stats, 'input');
  const completeOutput = isComplete(stats, 'output');

  const addRatio = (
    key: string,
    numerator: number | bigint | null,
    denominator: number | bigint | null
  ) => {
    if (numerator === null || denominator === null) {
      return;
    }
    const value = ratio(numerator, denominator);
    if (value !== null) {
      derived.push({ key, value });
    }
  };

  if (completeInput) {
    addRatio('input_average_row_bytes', inputBytes, inputRows);
  }
  if (completeOutput) {
    addRatio('output_average_row_bytes', outputBytes, outputRows);
  }
  if (completeInput && completeOutput) {
    addRatio('row_selectivity', outputRows, inputRows);
    addRatio('traffic_amplification_ratio', outputBytes, inputBytes);
  }

  return derived;
}

export function sectionOperatorStatistics(
  stats: readonly PresentedStatistic[]
): Map<OperatorStatisticSection, PresentedStatistic[]> {
  const sections = new Map<OperatorStatisticSection, PresentedStatistic[]>([
    ['Flow', []],
    ['Decision', []],
    ['Algorithm', []],
    ['Execution', []],
  ]);

  for (const statistic of stats) {
    let section: OperatorStatisticSection;
    if (FLOW_FIELDS.has(statistic.key)) {
      section = 'Flow';
    } else if (statistic.key.startsWith('join_')) {
      section = 'Decision';
    } else if (
      statistic.key === 'runtime_actor_id' ||
      statistic.key === 'execution_status' ||
      statistic.key === 'first_error' ||
      statistic.key.startsWith('tasks_') ||
      statistic.key.startsWith('input_batches_')
    ) {
      section = 'Execution';
    } else {
      section = 'Algorithm';
    }
    sections.get(section)!.push(statistic);
  }

  sections.get('Flow')!.push(...deriveFlowStatistics(stats));
  return sections;
}
