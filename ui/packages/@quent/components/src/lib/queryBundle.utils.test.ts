// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  ENTITY_REF_TO_ENTITIES_KEY,
  entityRefToEntitiesKey,
  parseOperatorInformation,
  parseOperatorObservations,
  parsePortInformation,
} from './queryBundle.utils';

describe('entityRefToEntitiesKey', () => {
  it.each([
    ['Engine', 'engine'],
    ['QueryGroup', 'query_group'],
    ['Query', 'query'],
    ['Plan', 'plans'],
    ['Worker', 'workers'],
    ['Operator', 'operators'],
    ['Port', 'ports'],
    ['ResourceGroup', 'resource_groups'],
    ['Resource', 'resources'],
  ] as const)('maps %s to %s', (entity, collection) => {
    expect(entityRefToEntitiesKey(entity)).toBe(collection);
  });

  it('omits entities with no QueryEntities collection', () => {
    expect(entityRefToEntitiesKey('Task')).toBeUndefined();
    expect(Object.keys(ENTITY_REF_TO_ENTITIES_KEY)).toHaveLength(9);
  });
});

function tagged(variant: string, value: unknown) {
  return { [variant]: value };
}

const ORDERED_INFORMATION = [
  {
    heading: 'zeta_2',
    items: [
      { key: 'mixedCase', value: tagged('UInt64', 7), quantity: null },
      { key: 'alpha_value', value: null, quantity: null },
      { key: 'repeat', value: tagged('String', 'first'), quantity: null },
      { key: 'repeat', value: tagged('String', 'second'), quantity: 'bytes' },
    ],
  },
  {
    heading: 'Alpha 10',
    items: [{ key: 'numeric_10', value: tagged('UInt64', 10), quantity: null }],
  },
];

const PARSED_INFORMATION = [
  {
    heading: 'zeta_2',
    items: [
      { key: 'mixedCase', value: 7 },
      { key: 'alpha_value', value: null },
      { key: 'repeat', value: 'first' },
      { key: 'repeat', value: 'second', quantity: 'bytes' },
    ],
  },
  {
    heading: 'Alpha 10',
    items: [{ key: 'numeric_10', value: 10 }],
  },
];

describe('parseOperatorInformation', () => {
  it('preserves exact group and item order, repeated keys, nulls, and quantities', () => {
    expect(parseOperatorInformation({ statistics: { information: ORDERED_INFORMATION } })).toEqual(
      PARSED_INFORMATION
    );
  });

  it('returns an empty list when information is absent', () => {
    expect(parseOperatorInformation(null)).toEqual([]);
    expect(parseOperatorInformation({})).toEqual([]);
  });
});

describe('parseOperatorObservations', () => {
  it('preserves ordered observation attributes including repeated keys', () => {
    expect(
      parseOperatorObservations({
        observations: [
          {
            time_s: 0.25,
            kind: 'producer_event',
            custom_attributes: [
              { key: 'zChoice', value: tagged('UInt64', 7) },
              { key: 'alpha_choice', value: null },
              { key: 'repeat', value: tagged('String', 'first') },
              { key: 'repeat', value: tagged('String', 'second') },
            ],
          },
        ],
      })
    ).toEqual([
      {
        timeSeconds: 0.25,
        kind: 'producer_event',
        attributes: [
          { key: 'zChoice', value: 7 },
          { key: 'alpha_choice', value: null },
          { key: 'repeat', value: 'first' },
          { key: 'repeat', value: 'second' },
        ],
      },
    ]);
  });

  it('returns an empty list when observations are absent', () => {
    expect(parseOperatorObservations(undefined)).toEqual([]);
    expect(parseOperatorObservations({})).toEqual([]);
  });
});

describe('parsePortInformation', () => {
  it('preserves exact producer order', () => {
    expect(parsePortInformation({ statistics: { information: ORDERED_INFORMATION } })).toEqual(
      PARSED_INFORMATION
    );
  });

  it('returns an empty list when information is absent', () => {
    expect(parsePortInformation(null)).toEqual([]);
    expect(parsePortInformation({})).toEqual([]);
  });
});
