// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OperatorStatFields } from './OperatorStatFields';

describe('OperatorStatFields', () => {
  it('groups flow, decision, algorithm, execution, and port evidence', () => {
    render(
      <OperatorStatFields
        operator={{
          nodeId: 'join-1',
          label: 'Join',
          operationType: 'join',
          statistics: [
            { key: 'input_rows', value: 100 },
            { key: 'join_selected_input', value: 1 },
            { key: 'build_rows', value: 25 },
            { key: 'tasks_completed', value: 2 },
          ],
          ports: [
            {
              id: 'port-1',
              name: 'input_1',
              statistics: [
                { key: 'direction', value: 'input' },
                { key: 'rows', value: 25 },
              ],
            },
          ],
        }}
      />
    );

    for (const heading of ['Flow', 'Decision', 'Algorithm', 'Execution', 'Ports']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('input_1')).toBeInTheDocument();
    expect(screen.getByText('Raw statistics')).toBeInTheDocument();
  });

  it('renders bigint values with inferred units and null as unavailable', () => {
    render(
      <OperatorStatFields
        operator={{
          nodeId: 'sort-1',
          label: 'Sort',
          operationType: 'sort',
          statistics: [
            { key: 'retained_bytes_peak', value: 1048576n },
            { key: 'first_error', value: null },
          ],
        }}
      />
    );

    expect(screen.getAllByText('1.00 MiB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
