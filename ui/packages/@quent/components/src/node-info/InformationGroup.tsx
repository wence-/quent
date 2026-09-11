// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@quent/utils';

export function InformationGroup({
  heading,
  children,
  className,
}: {
  heading: string;
  children: ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={cn('mt-2 border-t pt-1', className)}>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        aria-expanded={isOpen}
        aria-label={`Toggle ${heading} information`}
        onClick={() => setIsOpen(open => !open)}
      >
        <ChevronRight
          className={cn('h-3 w-3 shrink-0 transition-transform', isOpen && 'rotate-90')}
        />
        <span>{heading}</span>
      </button>
      {isOpen && <div className="pl-4">{children}</div>}
    </section>
  );
}
