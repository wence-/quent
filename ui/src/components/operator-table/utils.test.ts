// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { buildOrderedOperatorStatistics } from './utils';

describe('buildOrderedOperatorStatistics', () => {
  it('preserves producer order and repeated keys without overwriting values', () => {
    const result = buildOrderedOperatorStatistics(
      [
        {
          heading: 'Zeta',
          items: [
            { key: 'mixed_Key', value: 7, quantity: 'rows' },
            { key: 'alpha2', value: null },
          ],
        },
        {
          heading: 'Alpha',
          items: [{ key: 'mixed_Key', value: 'again' }],
        },
      ],
      1.23456789
    );

    expect(result.stats).toEqual([
      ['duration_s', 1.234568],
      ['mixed_Key', 7],
      ['alpha2', null],
      ['mixed_Key (2)', 'again'],
    ]);
    expect(result.statQuantities).toEqual({ mixed_Key: 'rows' });
  });
});
