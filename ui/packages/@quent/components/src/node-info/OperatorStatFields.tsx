// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { InspectedOperatorData } from '@quent/hooks';
import {
  findInformationItem,
  formatStatWithQuantity,
  isNumericValue,
  type InspectedInformationGroup,
  type InspectedOperatorObservation,
  type InspectedPortData,
  type QuantitySpec,
  type StatValue,
} from '@quent/utils';
import { DataText } from '../ui/data-text';
import { InformationGroup } from './InformationGroup';

type PresentedStatistic = InspectedInformationGroup['items'][number];

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
  return statistics.map(({ key, value, quantity }, index) => (
    <div key={`${key}-${index}`} className="text-xs flex items-start justify-between gap-2">
      <DataText className="capitalize">{key.replace(/_/g, ' ')}:</DataText>
      <StatisticValue name={key} value={value} quantity={quantity} quantitySpecs={quantitySpecs} />
    </div>
  ));
}

function InformationSections({
  information,
  quantitySpecs,
  omittedKeys,
}: {
  information: readonly InspectedInformationGroup[];
  quantitySpecs?: { [key: string]: QuantitySpec | undefined };
  omittedKeys?: ReadonlySet<string>;
}) {
  return information.map((group, groupIndex) => {
    const items = omittedKeys
      ? group.items.filter(item => !omittedKeys.has(item.key))
      : group.items;
    return items.length ? (
      <InformationGroup key={`${group.heading}-${groupIndex}`} heading={group.heading}>
        <StatisticRows statistics={items} quantitySpecs={quantitySpecs} />
      </InformationGroup>
    ) : null;
  });
}

function humanizeRole(role: string): string {
  const words = role.replace(/_/g, ' ').trim();
  return words ? `${words[0].toUpperCase()}${words.slice(1)} input` : 'Referenced input';
}

function PortRows({
  port,
  relationLabel,
}: {
  port: InspectedPortData;
  relationLabel: string | null;
}) {
  const direction = findInformationItem(port.information, 'direction')?.value;
  return (
    <div className="border-t first:border-t-0 py-1">
      <div className="flex items-center justify-between text-xs font-medium">
        <DataText>{port.name ?? port.id}</DataText>
        {direction != null && (
          <DataText className="text-muted-foreground">{String(direction)}</DataText>
        )}
        {relationLabel && (
          <DataText className="rounded bg-primary/15 px-1 text-primary">{relationLabel}</DataText>
        )}
      </div>
      <InformationSections information={port.information} />
    </div>
  );
}

function ObservationRows({ observation }: { observation: InspectedOperatorObservation }) {
  return (
    <div className="border-t first:border-t-0 py-1">
      <div className="flex items-center justify-between gap-2 text-xs font-medium">
        <DataText>{observation.kind}</DataText>
        <DataText className="text-muted-foreground">
          {observation.timeSeconds.toFixed(6)} s
        </DataText>
      </div>
      <StatisticRows statistics={observation.attributes} />
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
  const selectedInputPortId = findInformationItem(
    operator.information,
    'selected_input_port_id'
  )?.value;
  const selectedInputPortRole = findInformationItem(
    operator.information,
    'selected_input_port_role'
  )?.value;
  const resolvedInputPortId =
    typeof selectedInputPortId === 'string' &&
    operator.ports?.some(port => port.id === selectedInputPortId)
      ? selectedInputPortId
      : null;
  const relationLabel = resolvedInputPortId
    ? typeof selectedInputPortRole === 'string' && selectedInputPortRole.trim()
      ? humanizeRole(selectedInputPortRole)
      : 'Referenced input'
    : null;
  const omittedRelationKeys = resolvedInputPortId
    ? new Set(['selected_input_port_id', 'selected_input_port_role'])
    : undefined;

  return (
    <>
      <div className="text-xs flex items-center justify-between">
        <DataText className="capitalize">ID:</DataText>
        <DataText className="text-muted-foreground ml-1 truncate">{operator.nodeId}</DataText>
      </div>
      <InformationSections
        information={operator.information}
        quantitySpecs={quantitySpecs}
        omittedKeys={omittedRelationKeys}
      />
      {operator.ports && operator.ports.length > 0 && (
        <section className="mt-2 border-t pt-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ports
          </h4>
          {operator.ports.map(port => (
            <PortRows
              key={port.id}
              port={port}
              relationLabel={port.id === resolvedInputPortId ? relationLabel : null}
            />
          ))}
        </section>
      )}
      {operator.observations.length > 0 && (
        <section className="mt-2 border-t pt-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Observations
          </h4>
          {operator.observations.map((observation, index) => (
            <ObservationRows
              key={`${observation.timeSeconds}-${observation.kind}-${index}`}
              observation={observation}
            />
          ))}
        </section>
      )}
      <details className="mt-2 border-t pt-1 text-xs">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Raw statistics
        </summary>
        <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
          {JSON.stringify(
            operator.information,
            (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
            2
          )}
        </pre>
      </details>
    </>
  );
};
