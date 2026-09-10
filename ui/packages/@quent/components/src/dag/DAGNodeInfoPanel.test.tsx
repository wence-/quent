// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'jotai';
import { useSetGraphInspection, useSetSelectedNodeData } from '@quent/hooks';
import { getOperationTypeColor } from '@quent/utils';
import { DAGNodeInfoPanel } from './DAGNodeInfoPanel';

function SelectedNode() {
  const setSelectedNodeData = useSetSelectedNodeData();

  useEffect(() => {
    setSelectedNodeData({
      selectionId: 'logical',
      data: {
        nodeId: 'logical',
        label: 'Logical join',
        operationType: 'logicaljoin',
        statistics: [{ key: 'logical_rows', value: 10 }],
        observations: [],
        relatedOperators: [
          {
            nodeId: 'physical-1',
            label: 'Build hash table',
            operationType: 'hashbuild',
            statistics: [{ key: 'build_rows', value: 20 }],
            observations: [],
          },
          {
            nodeId: 'physical-2',
            label: 'Probe hash table',
            operationType: 'hashprobe',
            statistics: [{ key: 'probe_rows', value: 30 }],
            observations: [],
          },
        ],
      },
    });
  }, [setSelectedNodeData]);

  return <DAGNodeInfoPanel />;
}

function SwitchSelectedNode() {
  const [showLogical, setShowLogical] = useState(true);
  const setSelectedNodeData = useSetSelectedNodeData();

  useEffect(() => {
    const data = showLogical
      ? {
          nodeId: 'logical',
          label: 'Logical join',
          operationType: 'logicaljoin',
          statistics: [],
          observations: [],
        }
      : {
          nodeId: 'scan',
          label: 'Table scan',
          operationType: 'scan',
          statistics: [],
          observations: [],
        };
    setSelectedNodeData({ selectionId: data.nodeId, data });
  }, [setSelectedNodeData, showLogical]);

  return (
    <>
      <button onClick={() => setShowLogical(value => !value)}>Switch operator</button>
      <DAGNodeInfoPanel />
    </>
  );
}

function SelectedPipe() {
  const setGraphInspection = useSetGraphInspection();

  useEffect(() => {
    setGraphInspection({
      kind: 'pipe',
      sourcePortId: 'source-port',
      targetPortId: 'target-port',
      source: {
        operatorId: 'source',
        operatorLabel: 'Scan',
        port: {
          id: 'source-port',
          name: 'output_0',
          statistics: [
            { key: 'rows', value: 0 },
            { key: 'bytes', value: 10 },
          ],
        },
      },
      target: {
        operatorId: 'target',
        operatorLabel: 'Zip',
        port: {
          id: 'target-port',
          name: 'input_1',
          statistics: [
            { key: 'rows', value: 0 },
            { key: 'bytes', value: 9 },
            { key: 'waits', value: 1 },
          ],
        },
      },
    });
  }, [setGraphInspection]);

  return <DAGNodeInfoPanel />;
}

describe('DAGNodeInfoPanel', () => {
  it('shows statistics for every related child operator', async () => {
    render(
      <Provider>
        <SelectedNode />
      </Provider>
    );

    const title = await screen.findByTestId('operator-details-title');
    expect(within(title).getByText('Logical join')).toHaveAttribute('title', 'Logical join');
    expect(screen.getByText('Build hash table')).toBeInTheDocument();
    expect(screen.getByText('Probe hash table')).toBeInTheDocument();
    expect(screen.getByText('build rows:')).toBeInTheDocument();
    expect(screen.getByText('probe rows:')).toBeInTheDocument();
    expect(screen.getByText('physical-1')).toBeInTheDocument();
    expect(screen.getByText('physical-2')).toBeInTheDocument();

    const bars = screen.getAllByTestId('operator-color-bar');
    expect(
      bars.filter(bar => bar.getAttribute('data-operation-type') === 'logicaljoin')
    ).not.toHaveLength(0);
    expect(bars.find(bar => bar.getAttribute('data-operation-type') === 'hashbuild')).toHaveStyle({
      backgroundColor: getOperationTypeColor('hashbuild'),
    });
    expect(bars.find(bar => bar.getAttribute('data-operation-type') === 'hashprobe')).toHaveStyle({
      backgroundColor: getOperationTypeColor('hashprobe'),
    });
  });

  it('resets collapsed operators when the selected root changes', async () => {
    render(
      <Provider>
        <SwitchSelectedNode />
      </Provider>
    );

    const logicalToggle = await screen.findByRole('button', {
      name: 'Toggle Logical join details',
    });
    fireEvent.click(logicalToggle);
    expect(logicalToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Switch operator' }));
    expect(
      await screen.findByRole('button', { name: 'Toggle Table scan details' })
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Switch operator' }));
    expect(
      await screen.findByRole('button', { name: 'Toggle Logical join details' })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses related child operators independently', async () => {
    render(
      <Provider>
        <SelectedNode />
      </Provider>
    );

    const relatedToggle = await screen.findByRole('button', {
      name: 'Toggle Build hash table details',
    });
    expect(relatedToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('build rows:')).toBeInTheDocument();

    fireEvent.click(relatedToggle);

    expect(relatedToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('build rows:')).not.toBeInTheDocument();
    expect(screen.getByText('probe rows:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle Logical join details' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('shows selected pipe endpoints and preserves agreement distinctions', async () => {
    render(
      <Provider>
        <SelectedPipe />
      </Provider>
    );

    expect(await screen.findByText('Pipe Details')).toBeInTheDocument();
    expect(screen.getByText('Source · Scan')).toBeInTheDocument();
    expect(screen.getByText('Target · Zip')).toBeInTheDocument();
    expect(screen.getByText('output_0')).toBeInTheDocument();
    expect(screen.getByText('input_1')).toBeInTheDocument();
    expect(screen.getByText('Agrees')).toBeInTheDocument();
    expect(screen.getByText('Differs')).toBeInTheDocument();
    expect(screen.getByText('Missing endpoint')).toBeInTheDocument();
  });
});
