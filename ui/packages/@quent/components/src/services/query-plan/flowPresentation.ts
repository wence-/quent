// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  formatCompactWithPrefix,
  inferFieldFormatter,
  isNumericValue,
  type DAGEdge,
  type StatValue,
} from '@quent/utils';

type Statistic = { key: string; value: StatValue };

function findNumeric(stats: readonly Statistic[], key: string): number | bigint | null {
  const value = stats.find(stat => stat.key === key)?.value;
  return value != null && isNumericValue(value) ? value : null;
}

function hasUnknown(stats: readonly Statistic[], key: string): boolean {
  const value = findNumeric(stats, `${key}_unknown_messages`);
  return value !== null && value !== 0 && value !== 0n;
}

function formatFlowValue(stats: readonly Statistic[], key: string): string | null {
  const value = findNumeric(stats, key);
  if (value === null) {
    return null;
  }
  return `${formatFlowNumber(key, value)}${hasUnknown(stats, key) ? ' +?' : ''}`;
}

function formatFlowNumber(key: string, value: number | bigint): string {
  if (key === 'rows' || key.endsWith('_rows') || key === 'messages' || key.endsWith('_messages')) {
    return formatCompactWithPrefix(Number(value), '', 'Si');
  }
  return inferFieldFormatter(key)(value);
}

/** Compact rows/bytes label sourced only from the authoritative sending port. */
export function formatEdgeFlowLabel(edge: DAGEdge): string | null {
  const stats = edge.portStats ?? [];
  const rows = formatFlowValue(stats, 'rows');
  const bytes = formatFlowValue(stats, 'bytes');
  const parts = [rows, bytes].filter((value): value is string => value !== null);
  return parts.length ? parts.join(' · ') : null;
}

function formatPortStats(
  label: string,
  id: string | undefined,
  stats: readonly Statistic[]
): string {
  const heading = id ? `${label} (${id})` : label;
  if (!stats.length) {
    return `${heading}: no statistics`;
  }
  return [
    heading,
    ...stats.map(stat => {
      const value = stat.value;
      const formatted =
        value != null && isNumericValue(value) ? formatFlowNumber(stat.key, value) : String(value);
      return `${stat.key}: ${formatted}`;
    }),
  ].join('\n');
}

/** Detailed native tooltip retaining sent and received evidence separately. */
export function formatEdgeTooltip(edge: DAGEdge): string {
  return [
    formatPortStats(edge.sourcePortName ?? 'Source port', edge.sourcePortId, edge.portStats ?? []),
    formatPortStats(
      edge.targetPortName ?? 'Target port',
      edge.targetPortId,
      edge.targetPortStats ?? []
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
  selectedStatistics: readonly Statistic[] | undefined
): boolean {
  if (!selectedNodeId || edge.target !== selectedNodeId || !edge.targetPortId) {
    return false;
  }
  const selectedPortId = selectedStatistics?.find(
    stat => stat.key === 'selected_input_port_id'
  )?.value;
  return typeof selectedPortId === 'string' && edge.targetPortId === selectedPortId;
}

/** Compact operator aggregate. Port data is intentionally not a fallback. */
export function formatOperatorFlowSummary(stats: readonly Statistic[]): string[] {
  return (['input', 'output'] as const).flatMap(direction => {
    const rows = formatFlowValue(stats, `${direction}_rows`);
    const bytes = formatFlowValue(stats, `${direction}_bytes`);
    const parts = [rows, bytes].filter((value): value is string => value !== null);
    return parts.length ? [`${direction === 'input' ? 'In' : 'Out'} ${parts.join(' · ')}`] : [];
  });
}
