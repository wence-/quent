// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OperatorStatFields } from './OperatorStatFields';

describe('OperatorStatFields', () => {
  it('shows flow, ports, observations, and producer-defined statistics', () => {
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
          observations: [
            {
              timeSeconds: 0.125,
              kind: 'join_build_selected',
              attributes: [
                { key: 'selected_side', value: 'right' },
                { key: 'candidates', value: ['left', 'right'] },
              ],
            },
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

    for (const heading of ['Flow', 'Ports', 'Observations', 'Statistics']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    for (const oldHeading of ['Decision', 'Algorithm', 'Execution']) {
      expect(screen.queryByRole('heading', { name: oldHeading })).not.toBeInTheDocument();
    }
    expect(screen.getByText('input_1')).toBeInTheDocument();
    expect(screen.getByText('join_build_selected')).toBeInTheDocument();
    expect(screen.getAllByText('right')).toHaveLength(2);
    expect(screen.getByText('left')).toBeInTheDocument();
    expect(screen.getByText('0.125000 s')).toBeInTheDocument();
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
          observations: [],
        }}
      />
    );

    expect(screen.getAllByText('1.00 MiB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders a producer with no statistics or observations', () => {
    render(
      <OperatorStatFields
        operator={{
          nodeId: 'fused-1',
          label: 'Fused operator',
          operationType: 'fused',
          statistics: [],
          observations: [],
        }}
      />
    );

    expect(screen.getByText('fused-1')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Raw statistics')).toBeInTheDocument();
  });
});
