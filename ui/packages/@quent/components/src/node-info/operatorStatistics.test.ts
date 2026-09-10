// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { deriveFlowStatistics, sectionOperatorStatistics } from './operatorStatistics';

describe('operator statistic presentation', () => {
  it('derives complete flow ratios', () => {
    const derived = deriveFlowStatistics([
      { key: 'input_rows', value: 100 },
      { key: 'input_rows_unknown_messages', value: 0 },
      { key: 'input_bytes', value: 1000 },
      { key: 'input_bytes_unknown_messages', value: 0 },
      { key: 'output_rows', value: 25 },
      { key: 'output_rows_unknown_messages', value: 0 },
      { key: 'output_bytes', value: 500 },
      { key: 'output_bytes_unknown_messages', value: 0 },
    ]);

    expect(Object.fromEntries(derived.map(stat => [stat.key, stat.value]))).toEqual({
      input_average_row_bytes: 10,
      output_average_row_bytes: 20,
      row_selectivity: 0.25,
      traffic_amplification_ratio: 0.5,
    });
  });

  it('does not derive ratios from partial values or zero denominators', () => {
    expect(
      deriveFlowStatistics([
        { key: 'input_rows', value: 0 },
        { key: 'input_rows_unknown_messages', value: 0 },
        { key: 'input_bytes', value: 0 },
        { key: 'input_bytes_unknown_messages', value: 1 },
        { key: 'output_rows', value: 10 },
        { key: 'output_rows_unknown_messages', value: 0 },
        { key: 'output_bytes', value: 20 },
        { key: 'output_bytes_unknown_messages', value: 0 },
      ])
    ).toEqual([{ key: 'output_average_row_bytes', value: 2 }]);
  });

  it('assigns known fields to stable sections and preserves unknown fields', () => {
    const sections = sectionOperatorStatistics([
      { key: 'input_rows', value: 10 },
      { key: 'join_selected_input', value: 1 },
      { key: 'tasks_completed', value: 2 },
      { key: 'future_statistic', value: 'visible' },
    ]);

    expect(sections.get('Flow')?.map(stat => stat.key)).toContain('input_rows');
    expect(sections.get('Decision')?.map(stat => stat.key)).toEqual(['join_selected_input']);
    expect(sections.get('Execution')?.map(stat => stat.key)).toEqual(['tasks_completed']);
    expect(sections.get('Algorithm')?.map(stat => stat.key)).toEqual(['future_statistic']);
  });
});
