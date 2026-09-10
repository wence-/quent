// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { InspectedOperatorData } from '@quent/hooks';
import {
  formatStatWithQuantity,
  isNumericValue,
  type InspectedPortData,
  type QuantitySpec,
  type StatValue,
} from '@quent/utils';
import { DataText } from '../ui/data-text';
import { sectionOperatorStatistics, type PresentedStatistic } from './operatorStatistics';

function StatisticValue({
  name,
  value,
  quantity,
  quantitySpecs,
}: {
  name: string;
  value: StatValue;
  quantity?: string;
  quantitySpecs?: { [key: string]: QuantitySpec | undefined };
}) {
  if (Array.isArray(value)) {
    return (
      <div className="ml-2 flex flex-col gap-0.5">
        {value.map((item, index) => (
          <DataText key={index} className="text-muted-foreground whitespace-pre-line">
            {String(item)}
          </DataText>
        ))}
      </div>
    );
  }

  return (
    <DataText className="text-muted-foreground ml-1">
      {value == null
        ? '—'
        : isNumericValue(value)
          ? formatStatWithQuantity(
              value,
              name,
              quantity && quantitySpecs ? quantitySpecs[quantity] : undefined
            )
          : String(value)}
    </DataText>
  );
}

function StatisticRows({
  statistics,
  quantitySpecs,
}: {
  statistics: readonly PresentedStatistic[];
  quantitySpecs?: { [key: string]: QuantitySpec | undefined };
}) {
  return statistics.map(({ key, value, quantity }) => (
    <div key={key} className="text-xs flex items-start justify-between gap-2">
      <DataText className="capitalize">{key.replace(/_/g, ' ')}:</DataText>
      <StatisticValue name={key} value={value} quantity={quantity} quantitySpecs={quantitySpecs} />
    </div>
  ));
}

function PortRows({ port }: { port: InspectedPortData }) {
  const direction = port.statistics.find(stat => stat.key === 'direction')?.value;
  return (
    <div className="border-t first:border-t-0 py-1">
      <div className="flex items-center justify-between text-xs font-medium">
        <DataText>{port.name ?? port.id}</DataText>
        {direction != null && (
          <DataText className="text-muted-foreground">{String(direction)}</DataText>
        )}
      </div>
      <StatisticRows statistics={port.statistics} />
    </div>
  );
}

export const OperatorStatFields = ({
  operator,
  quantitySpecs,
}: {
  operator: InspectedOperatorData;
  quantitySpecs?: { [key: string]: QuantitySpec | undefined };
}) => {
  const sections = sectionOperatorStatistics(operator.statistics);

  return (
    <>
      <div className="text-xs flex items-center justify-between">
        <DataText className="capitalize">ID:</DataText>
        <DataText className="text-muted-foreground ml-1 truncate">{operator.nodeId}</DataText>
      </div>
      {(['Flow'] as const).map(name => {
        const statistics = sections.get(name) ?? [];
        return statistics.length ? (
          <section key={name} className="mt-2 border-t pt-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {name}
            </h4>
            <StatisticRows statistics={statistics} quantitySpecs={quantitySpecs} />
          </section>
        ) : null;
      })}
      {operator.ports && operator.ports.length > 0 && (
        <section className="mt-2 border-t pt-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ports
          </h4>
          {operator.ports.map(port => (
            <PortRows key={port.id} port={port} />
          ))}
        </section>
      )}
      {(['Decision', 'Algorithm', 'Execution'] as const).map(name => {
        const statistics = sections.get(name) ?? [];
        return statistics.length ? (
          <section key={name} className="mt-2 border-t pt-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {name}
            </h4>
            <StatisticRows statistics={statistics} quantitySpecs={quantitySpecs} />
          </section>
        ) : null;
      })}
      <details className="mt-2 border-t pt-1 text-xs">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Raw statistics
        </summary>
        <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
          {JSON.stringify(
            Object.fromEntries(
              operator.statistics.map(statistic => [statistic.key, statistic.value])
            ),
            (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
            2
          )}
        </pre>
      </details>
    </>
  );
};
