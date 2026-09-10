// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EntityRef, Operator, Plan, PlanTree, QueryBundle } from '@quent/utils';

interface PlanCandidate {
  id: string;
  coverage: number;
  depth: number;
  order: number;
}

function runtimeStatisticsCoverage(bundle: QueryBundle<EntityRef>, plan: Plan): number {
  const portIds = new Set(plan.edges.flatMap(edge => [edge.source, edge.target]));
  const operatorIds = new Set(
    [...portIds].flatMap(portId => {
      const operatorId = bundle.entities.ports[portId]?.operator_id;
      return operatorId ? [operatorId] : [];
    })
  );
  const operators = Object.values(bundle.entities.operators).filter(
    (operator): operator is Operator => operator !== undefined && operatorIds.has(operator.id)
  );
  const ports = [...portIds].flatMap(portId => {
    const port = bundle.entities.ports[portId];
    return port ? [port] : [];
  });
  const entities = [...operators, ...ports];

  if (!entities.length) {
    return 0;
  }

  return entities.filter(entity => entity.statistics != null).length / entities.length;
}

/** Select the most informative plan, preferring coverage, depth, then tree order. */
export function getDefaultPlanId(bundle: QueryBundle<EntityRef>): string {
  const plans = bundle.entities.plans;
  const candidates: PlanCandidate[] = [];
  let order = 0;

  const visit = (node: PlanTree, depth: number) => {
    const plan = plans[node.id];
    if (plan) {
      candidates.push({
        id: node.id,
        coverage: runtimeStatisticsCoverage(bundle, plan),
        depth,
        order,
      });
    }
    order += 1;
    node.children.forEach(child => visit(child, depth + 1));
  };

  visit(bundle.plan_tree, 0);

  candidates.sort(
    (left, right) =>
      right.coverage - left.coverage || right.depth - left.depth || left.order - right.order
  );
  return candidates[0]?.id ?? bundle.plan_tree.id;
}
