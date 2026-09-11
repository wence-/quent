// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  useHighlightedNodeIds,
  useSetSelectedNodeIds,
  useSetSelectedOperatorLabel,
} from '@quent/hooks';
import {
  cn,
  informationItems,
  type InspectedInformationItem,
  type InspectedPortData,
  type PipeInspection,
  type StatValue,
} from '@quent/utils';
import { DataText } from '../ui/data-text';
import { InformationGroup } from './InformationGroup';

function displayValue(value: StatValue): string {
  if (value == null) {
    return '—';
  }
  return Array.isArray(value) ? value.map(String).join(', ') : String(value);
}

function EndpointDetails({
  side,
  operatorId,
  operatorLabel,
  port,
}: {
  side: 'Source' | 'Target';
  operatorId: string;
  operatorLabel: string;
  port: InspectedPortData;
}) {
  const setSelectedNodeIds = useSetSelectedNodeIds();
  const setSelectedOperatorLabel = useSetSelectedOperatorLabel();
  const [highlightState, setHighlightState] = useHighlightedNodeIds();
  const isHighlighted =
    highlightState.source === 'dag' && highlightState.primaryOperatorId === operatorId;
  const setHighlighted = () => {
    setHighlightState(previous => ({
      ...previous,
      ids: new Set([operatorId]),
      source: 'dag',
      primaryOperatorId: operatorId,
    }));
  };
  const clearHighlighted = () => {
    setHighlightState(previous =>
      previous.source === 'dag' && previous.primaryOperatorId === operatorId
        ? { ...previous, ids: null, source: null, primaryOperatorId: null }
        : previous
    );
  };

  return (
    <section
      data-testid={`pipe-endpoint-${side.toLowerCase()}`}
      className={cn('rounded px-1 transition-colors', isHighlighted && 'bg-primary/10')}
      onMouseEnter={setHighlighted}
      onMouseLeave={clearHighlighted}
    >
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <button
          type="button"
          className="cursor-pointer rounded underline decoration-muted-foreground/50 underline-offset-2 hover:text-primary"
          aria-label={`Inspect ${side.toLowerCase()} operator ${operatorLabel}`}
          onClick={() => {
            clearHighlighted();
            setSelectedNodeIds(new Set([operatorId]));
            setSelectedOperatorLabel(operatorLabel);
          }}
          onFocus={setHighlighted}
          onBlur={clearHighlighted}
        >
          {side} · {operatorLabel}
        </button>
      </h4>
      <div className="text-xs">
        <DataText>{port.name ?? port.id}</DataText>
        {port.name && <DataText className="text-muted-foreground ml-1">({port.id})</DataText>}
      </div>
      {port.information.length === 0 ? (
        <DataText className="text-xs text-muted-foreground">No statistics</DataText>
      ) : (
        port.information.map((group, groupIndex) => (
          <InformationGroup
            key={`${group.heading}-${groupIndex}`}
            heading={group.heading}
            className="mt-1 first:border-t-0"
          >
            {group.items.map((item, itemIndex) => (
              <div
                key={`${item.key}-${itemIndex}`}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <DataText className="capitalize">{item.key.replace(/_/g, ' ')}:</DataText>
                <DataText className="text-muted-foreground ml-1">
                  {displayValue(item.value)}
                </DataText>
              </div>
            ))}
          </InformationGroup>
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
  const sourceItems = informationItems(pipe.source.port.information);
  const targetItems = informationItems(pipe.target.port.information);
  const comparedItems = comparisonItems(sourceItems, targetItems);

  return (
    <div className="grid grid-cols-1 gap-3 pt-1.5 pr-2 sm:grid-cols-2">
      <EndpointDetails
        side="Source"
        operatorId={pipe.source.operatorId}
        operatorLabel={pipe.source.operatorLabel}
        port={pipe.source.port}
      />
      <EndpointDetails
        side="Target"
        operatorId={pipe.target.operatorId}
        operatorLabel={pipe.target.operatorLabel}
        port={pipe.target.port}
      />
      {comparedItems.length > 0 && (
        <section className="sm:col-span-2 border-t pt-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Endpoint agreement
          </h4>
          {comparedItems.map(({ key, occurrence, source, target }) => {
            const agrees = source && target && valuesEqual(source.value, target.value);
            return (
              <div
                key={`${key}-${occurrence}`}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <DataText className="capitalize">
                  {key.replace(/_/g, ' ')}
                  {occurrence > 0 ? ` (${occurrence + 1})` : ''}:
                </DataText>
                <DataText className="text-muted-foreground">
                  {!source || !target ? 'Missing endpoint' : agrees ? 'Agrees' : 'Differs'}
                </DataText>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

interface ComparedItem {
  key: string;
  occurrence: number;
  source?: InspectedInformationItem;
  target?: InspectedInformationItem;
}

function itemOccurrence(items: readonly InspectedInformationItem[], index: number): number {
  return items.slice(0, index).filter(item => item.key === items[index].key).length;
}

function findOccurrence(
  items: readonly InspectedInformationItem[],
  key: string,
  occurrence: number
): InspectedInformationItem | undefined {
  return items.filter(item => item.key === key)[occurrence];
}

function comparisonItems(
  sourceItems: readonly InspectedInformationItem[],
  targetItems: readonly InspectedInformationItem[]
): ComparedItem[] {
  const source = sourceItems.map((item, index) => {
    const occurrence = itemOccurrence(sourceItems, index);
    return {
      key: item.key,
      occurrence,
      source: item,
      target: findOccurrence(targetItems, item.key, occurrence),
    };
  });
  const targetOnly = targetItems.flatMap((item, index) => {
    const occurrence = itemOccurrence(targetItems, index);
    return findOccurrence(sourceItems, item.key, occurrence)
      ? []
      : [{ key: item.key, occurrence, target: item }];
  });
  return [...source, ...targetOnly];
}
