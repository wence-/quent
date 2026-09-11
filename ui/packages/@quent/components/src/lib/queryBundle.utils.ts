// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  EntityRefKey,
  unwrapTaggedValue,
  type InspectedInformationGroup,
  type InspectedOperatorObservation,
  type Operator,
  type Port,
  type QueryEntities,
} from '@quent/utils';

// Maps entity ref string to a key in the entities object.
// Task has no corresponding collection in QueryEntities, so it is omitted.
export const ENTITY_REF_TO_ENTITIES_KEY: Partial<Record<EntityRefKey, keyof QueryEntities>> = {
  Engine: 'engine',
  QueryGroup: 'query_group',
  Query: 'query',
  Plan: 'plans',
  Worker: 'workers',
  Operator: 'operators',
  Port: 'ports',
  ResourceGroup: 'resource_groups',
  Resource: 'resources',
} as const;

/**
 * Converts an EntityRef to the corresponding key in the QueryEntities object.
 * Returns undefined for entity types with no QueryEntities collection (e.g. Task).
 */
export function entityRefToEntitiesKey(entityRef: EntityRefKey): keyof QueryEntities | undefined {
  return ENTITY_REF_TO_ENTITIES_KEY[entityRef];
}

function parseInformation(
  information:
    | NonNullable<Operator['statistics']>['information']
    | NonNullable<Port['statistics']>['information']
    | undefined
): InspectedInformationGroup[] {
  if (!information) {
    return [];
  }

  return information.map(group => ({
    heading: group.heading,
    items: group.items.map(({ key, value, quantity }) => ({
      key,
      value: value == null ? null : unwrapTaggedValue(value),
      ...(quantity !== null ? { quantity } : {}),
    })),
  }));
}

export function parseOperatorInformation(rawNode: unknown): InspectedInformationGroup[] {
  return parseInformation((rawNode as Operator)?.statistics?.information);
}

export function parseOperatorObservations(rawNode: unknown): InspectedOperatorObservation[] {
  const observations = (rawNode as Operator)?.observations;
  if (!observations) {
    return [];
  }

  return observations.map(observation => ({
    timeSeconds: observation.time_s,
    kind: observation.kind,
    attributes: observation.custom_attributes.map(({ key, value }) => ({
      key,
      value: value == null ? null : unwrapTaggedValue(value),
    })),
  }));
}

export function parsePortInformation(rawPort: unknown): InspectedInformationGroup[] {
  return parseInformation((rawPort as Port)?.statistics?.information);
}
