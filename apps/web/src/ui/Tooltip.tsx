import { ReactNode } from 'react';

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block">
        {content}
      </span>
    </span>
  );
}
