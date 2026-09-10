// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const EDGE_INTERACTION_WIDTH = 16;

export function getEdgeInteractionWidth(strokeWidth: number): number {
  return Math.max(EDGE_INTERACTION_WIDTH, strokeWidth);
}

export function isEdgeInspectionKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
