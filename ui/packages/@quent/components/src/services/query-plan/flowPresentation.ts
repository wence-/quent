// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  formatCompactWithPrefix,
  findInformationItem,
  inferFieldFormatter,
  isNumericValue,
  type DAGEdge,
  type InspectedInformationGroup,
} from '@quent/utils';

export const SELECTED_INPUT_EDGE_COLOR = '#d97706';

function findNumeric(
  information: readonly InspectedInformationGroup[],
  key: string
): number | bigint | null {
  const value = findInformationItem(information, key)?.value;
  return value != null && isNumericValue(value) ? value : null;
}

function hasUnknown(information: readonly InspectedInformationGroup[], key: string): boolean {
  const value = findNumeric(information, `${key}_unknown_messages`);
  return value !== null && value !== 0 && value !== 0n;
}

function formatFlowValue(
  information: readonly InspectedInformationGroup[],
  key: string
): string | null {
  const value = findNumeric(information, key);
  if (value === null) {
    return null;
  }
  return `${formatFlowNumber(key, value)}${hasUnknown(information, key) ? ' +?' : ''}`;
}

function formatFlowNumber(key: string, value: number | bigint): string {
  if (key === 'rows' || key.endsWith('_rows') || key === 'messages' || key.endsWith('_messages')) {
    return formatCompactWithPrefix(Number(value), '', 'Si');
  }
  return inferFieldFormatter(key)(value);
}

/** Compact rows/bytes label sourced only from the authoritative sending port. */
export function formatEdgeFlowLabel(edge: DAGEdge): string | null {
  const information = edge.portInformation ?? [];
  const rows = formatFlowValue(information, 'rows');
  const bytes = formatFlowValue(information, 'bytes');
  const parts = [rows, bytes].filter((value): value is string => value !== null);
  return parts.length ? parts.join(' · ') : null;
}

function formatPortInformation(
  label: string,
  id: string | undefined,
  information: readonly InspectedInformationGroup[]
): string {
  const heading = id ? `${label} (${id})` : label;
  if (!information.length) {
    return `${heading}: no statistics`;
  }
  return [
    heading,
    ...information.flatMap(group => [
      group.heading,
      ...group.items.map(item => {
        const value = item.value;
        const formatted =
          value != null && isNumericValue(value)
            ? formatFlowNumber(item.key, value)
            : String(value);
        return `${item.key}: ${formatted}`;
      }),
    ]),
  ].join('\n');
}

/** Detailed native tooltip retaining sent and received evidence separately. */
export function formatEdgeTooltip(edge: DAGEdge): string {
  return [
    formatPortInformation(
      edge.sourcePortName ?? 'Source port',
      edge.sourcePortId,
      edge.portInformation ?? []
    ),
    formatPortInformation(
      edge.targetPortName ?? 'Target port',
      edge.targetPortId,
      edge.targetPortInformation ?? []
    ),
  ].join('\n\n');
}

export function normalizeEdgeWidth(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0.5;
  }
  const clamped = Math.min(max, Math.max(min, value));
  return (Math.log1p(clamped) - Math.log1p(min)) / (Math.log1p(max) - Math.log1p(min));
}

export function isSelectedInputEdge(
  edge: DAGEdge,
  selectedNodeId: string | undefined,
  selectedInformation: readonly InspectedInformationGroup[] | undefined
): boolean {
  if (!selectedNodeId || edge.target !== selectedNodeId || !edge.targetPortId) {
    return false;
  }
  const selectedPortId = selectedInformation
    ? findInformationItem(selectedInformation, 'selected_input_port_id')?.value
    : undefined;
  return typeof selectedPortId === 'string' && edge.targetPortId === selectedPortId;
}

/** Compact operator aggregate. Port data is intentionally not a fallback. */
export function formatOperatorFlowSummary(
  information: readonly InspectedInformationGroup[]
): string[] {
  return (['input', 'output'] as const).flatMap(direction => {
    const rows = formatFlowValue(information, `${direction}_rows`);
    const bytes = formatFlowValue(information, `${direction}_bytes`);
    const parts = [rows, bytes].filter((value): value is string => value !== null);
    return parts.length ? [`${direction === 'input' ? 'In' : 'Out'} ${parts.join(' · ')}`] : [];
  });
}
