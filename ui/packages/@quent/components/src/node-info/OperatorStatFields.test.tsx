// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { describe, expect, it } from 'vitest';
import { useHoveredPipeInspection, useRequestedPipeInspection } from '@quent/hooks';
import { OperatorStatFields } from './OperatorStatFields';

function PipeInteractionState() {
  const requested = useRequestedPipeInspection();
  const hovered = useHoveredPipeInspection();
  return (
    <>
      <output data-testid="requested-pipe">
        {requested ? `${requested.sourcePortId}:${requested.targetPortId}` : 'none'}
      </output>
      <output data-testid="hovered-pipe">
        {hovered ? `${hovered.sourcePortId}:${hovered.targetPortId}` : 'none'}
      </output>
    </>
  );
}

describe('OperatorStatFields', () => {
  it('renders producer groups in order and resolves a producer-supplied input role', () => {
    render(
      <OperatorStatFields
        operator={{
          nodeId: 'join-1',
          label: 'Join',
          operationType: 'join',
          information: [
            {
              heading: 'zeta_2',
              items: [
                { key: 'input_rows', value: 100 },
                { key: 'mixedCase', value: null },
              ],
            },
            {
              heading: 'Join',
              items: [
                { key: 'join_build_logical_side', value: 'right' },
                { key: 'selected_input_port_id', value: 'port-1' },
                { key: 'selected_input_port_role', value: 'build' },
              ],
            },
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
              connectedPipe: { sourcePortId: 'source-port', targetPortId: 'port-1' },
              information: [
                {
                  heading: 'Identity',
                  items: [{ key: 'direction', value: 'input' }],
                },
                {
                  heading: 'Volume',
                  items: [{ key: 'rows', value: 25 }],
                },
              ],
            },
          ],
        }}
      />
    );

    const informationToggles = screen
      .getAllByRole('button', { name: / information$/ })
      .filter(toggle => !toggle.getAttribute('aria-label')?.includes(' port information'));
    expect(informationToggles.map(toggle => toggle.textContent)).toEqual(['zeta_2', 'Join']);
    expect(
      informationToggles.every(toggle => toggle.getAttribute('aria-expanded') === 'false')
    ).toBe(true);
    expect(screen.getByText('input_1')).toBeInTheDocument();
    expect(screen.getByText('Build input')).toBeInTheDocument();
    expect(screen.getByTestId('port-relationship-bar-port-1')).toHaveStyle({
      backgroundColor: '#d97706',
    });
    const portToggle = screen.getByRole('button', {
      name: 'Toggle input_1 port information',
    });
    expect(portToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(portToggle);
    expect(screen.getByRole('button', { name: 'Toggle Identity information' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Toggle Volume information' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Selected input port id:')).not.toBeInTheDocument();
    expect(screen.queryByText('Selected input port role:')).not.toBeInTheDocument();
    expect(screen.getByText('join_build_selected')).toBeInTheDocument();
    expect(screen.queryByText('input rows:')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle zeta_2 information' }));
    expect(screen.getByText('input rows:')).toBeInTheDocument();
    expect(screen.getByText('mixedCase:')).toBeInTheDocument();
    expect(screen.getByText('0.125000 s')).toBeInTheDocument();
    expect(screen.getByText('Raw statistics')).toBeInTheDocument();
  });

  it('requests and transiently highlights the pipe connected to a port', () => {
    render(
      <Provider>
        <OperatorStatFields
          operator={{
            nodeId: 'operator-1',
            label: 'Operator',
            operationType: 'operator',
            information: [],
            observations: [],
            ports: [
              {
                id: 'input-port',
                name: 'input_0',
                information: [],
                connectedPipe: {
                  sourcePortId: 'output-port',
                  targetPortId: 'input-port',
                },
              },
            ],
          }}
        />
        <PipeInteractionState />
      </Provider>
    );

    const portRow = screen.getByTestId('port-row-input-port');
    const pipeButton = screen.getByRole('button', {
      name: 'Inspect pipe connected to input_0',
    });

    fireEvent.mouseEnter(portRow);
    expect(screen.getByTestId('hovered-pipe')).toHaveTextContent('output-port:input-port');
    fireEvent.mouseLeave(portRow);
    expect(screen.getByTestId('hovered-pipe')).toHaveTextContent('none');

    fireEvent.focus(pipeButton);
    expect(screen.getByTestId('hovered-pipe')).toHaveTextContent('output-port:input-port');
    fireEvent.click(pipeButton);
    expect(screen.getByTestId('requested-pipe')).toHaveTextContent('output-port:input-port');
    expect(screen.getByTestId('hovered-pipe')).toHaveTextContent('none');
  });

  it('renders bigint values with inferred units and null as unavailable', () => {
    render(
      <OperatorStatFields
        operator={{
          nodeId: 'sort-1',
          label: 'Sort',
          operationType: 'sort',
          information: [
            {
              heading: 'Sort',
              items: [
                { key: 'retained_bytes_peak', value: 1048576n },
                { key: 'first_error', value: null },
              ],
            },
          ],
          observations: [],
        }}
      />
    );

    const sortToggle = screen.getByRole('button', { name: 'Toggle Sort information' });
    expect(sortToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(sortToggle);
    expect(screen.getByText('1.00 MiB')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a producer with no statistics or observations', () => {
    render(
      <OperatorStatFields
        operator={{
          nodeId: 'fused-1',
          label: 'Fused operator',
          operationType: 'fused',
          information: [],
          observations: [],
        }}
      />
    );

    expect(screen.getByText('fused-1')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Raw statistics')).toBeInTheDocument();
  });
});
