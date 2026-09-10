// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { InspectedPortData, PipeInspection, StatValue } from '@quent/utils';
import { DataText } from '../ui/data-text';

function displayValue(value: StatValue): string {
  if (value == null) {
    return '—';
  }
  return Array.isArray(value) ? value.map(String).join(', ') : String(value);
}

function EndpointDetails({ label, port }: { label: string; port: InspectedPortData }) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      <div className="text-xs">
        <DataText>{port.name ?? port.id}</DataText>
        {port.name && <DataText className="text-muted-foreground ml-1">({port.id})</DataText>}
      </div>
      {port.statistics.length === 0 ? (
        <DataText className="text-xs text-muted-foreground">No statistics</DataText>
      ) : (
        port.statistics.map(statistic => (
          <div key={statistic.key} className="flex items-start justify-between gap-2 text-xs">
            <DataText className="capitalize">{statistic.key.replace(/_/g, ' ')}:</DataText>
            <DataText className="text-muted-foreground ml-1">
              {displayValue(statistic.value)}
            </DataText>
          </div>
        ))
      )}
    </section>
  );
}

function valuesEqual(left: StatValue, right: StatValue): boolean {
  return (
    JSON.stringify(left, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ) ===
    JSON.stringify(right, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );
}

export function PipeDetailsBlock({ pipe }: { pipe: PipeInspection }) {
  const sourceStatistics = new Map(pipe.source.port.statistics.map(stat => [stat.key, stat.value]));
  const targetStatistics = new Map(pipe.target.port.statistics.map(stat => [stat.key, stat.value]));
  const comparableKeys = [...new Set([...sourceStatistics.keys(), ...targetStatistics.keys()])];

  return (
    <div className="grid grid-cols-1 gap-3 pt-1.5 pr-2 sm:grid-cols-2">
      <EndpointDetails label={`Source · ${pipe.source.operatorLabel}`} port={pipe.source.port} />
      <EndpointDetails label={`Target · ${pipe.target.operatorLabel}`} port={pipe.target.port} />
      {comparableKeys.length > 0 && (
        <section className="sm:col-span-2 border-t pt-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Endpoint agreement
          </h4>
          {comparableKeys.map(key => {
            const hasSource = sourceStatistics.has(key);
            const hasTarget = targetStatistics.has(key);
            const agrees =
              hasSource &&
              hasTarget &&
              valuesEqual(sourceStatistics.get(key)!, targetStatistics.get(key)!);
            return (
              <div key={key} className="flex items-start justify-between gap-2 text-xs">
                <DataText className="capitalize">{key.replace(/_/g, ' ')}:</DataText>
                <DataText className="text-muted-foreground">
                  {!hasSource || !hasTarget ? 'Missing endpoint' : agrees ? 'Agrees' : 'Differs'}
                </DataText>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
