// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { EntityRef, Operator, Plan, PlanTree, Port, QueryBundle } from '@quent/utils';
import { getDefaultPlanId } from './plan-selection';

function makePlan(id: string, source: string, target: string): Plan {
  return {
    id,
    instance_name: null,
    parent: null,
    worker_id: null,
    edges: [{ source, target }],
  };
}

function makeOperator(id: string, withStatistics: boolean): Operator {
  return {
    id,
    plan_id: null,
    parent_operator_ids: [],
    instance_name: null,
    operator_type_name: 'Operator',
    custom_attributes: {},
    statistics: withStatistics ? { information: [] } : null,
    active_span: null,
  };
}

function makePort(id: string, operatorId: string, withStatistics: boolean): Port {
  return {
    id,
    operator_id: operatorId,
    instance_name: null,
    statistics: withStatistics ? { information: [] } : null,
  };
}

function makeTree(id: string, children: PlanTree[] = []): PlanTree {
  return { id, worker: null, children };
}

function makeBundle(
  tree: PlanTree,
  planSpecs: Array<{ id: string; populated: boolean }>
): QueryBundle<EntityRef> {
  const plans: Record<string, Plan> = {};
  const operators: Record<string, Operator> = {};
  const ports: Record<string, Port> = {};

  for (const spec of planSpecs) {
    const sourceOperatorId = `${spec.id}-source`;
    const targetOperatorId = `${spec.id}-target`;
    const sourcePortId = `${spec.id}-output`;
    const targetPortId = `${spec.id}-input`;
    plans[spec.id] = makePlan(spec.id, sourcePortId, targetPortId);
    operators[sourceOperatorId] = makeOperator(sourceOperatorId, spec.populated);
    operators[targetOperatorId] = makeOperator(targetOperatorId, spec.populated);
    ports[sourcePortId] = makePort(sourcePortId, sourceOperatorId, spec.populated);
    ports[targetPortId] = makePort(targetPortId, targetOperatorId, spec.populated);
  }

  return {
    entities: { plans, operators, ports },
    plan_tree: tree,
  } as unknown as QueryBundle<EntityRef>;
}

describe('getDefaultPlanId', () => {
  it('chooses a populated runtime descendant over a sparse root', () => {
    const tree = makeTree('root', [makeTree('logical', [makeTree('runtime')])]);
    const bundle = makeBundle(tree, [
      { id: 'root', populated: false },
      { id: 'logical', populated: false },
      { id: 'runtime', populated: true },
    ]);

    expect(getDefaultPlanId(bundle)).toBe('runtime');
  });

  it('uses depth when plans have equal statistics coverage', () => {
    const tree = makeTree('root', [makeTree('child', [makeTree('leaf')])]);
    const bundle = makeBundle(tree, [
      { id: 'root', populated: true },
      { id: 'child', populated: true },
      { id: 'leaf', populated: true },
    ]);

    expect(getDefaultPlanId(bundle)).toBe('leaf');
  });

  it('uses stable tree order as the final tie break', () => {
    const tree = makeTree('root', [makeTree('first'), makeTree('second')]);
    const bundle = makeBundle(tree, [
      { id: 'root', populated: false },
      { id: 'first', populated: false },
      { id: 'second', populated: false },
    ]);

    expect(getDefaultPlanId(bundle)).toBe('first');
  });

  it('falls back to the tree root when no tree node has a plan entity', () => {
    const bundle = makeBundle(makeTree('root'), []);

    expect(getDefaultPlanId(bundle)).toBe('root');
  });
});
