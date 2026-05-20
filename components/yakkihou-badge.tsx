import { cn } from '@/lib/utils';

interface Props {
  safe?: number;
  warn?: number;
  ng?: number;
  className?: string;
}

export function YakkihouBadge({ safe = 0, warn = 0, ng = 0, className }: Props) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm',
        className
      )}
    >
      <span className="flex items-center gap-1 text-yakkihou-safe">
        <span className="h-2 w-2 rounded-full bg-yakkihou-safe" />
        {safe}
      </span>
      <span className="flex items-center gap-1 text-yakkihou-warn">
        <span className="h-2 w-2 rounded-full bg-yakkihou-warn" />
        {warn}
      </span>
      <span className="flex items-center gap-1 text-yakkihou-ng">
        <span className="h-2 w-2 rounded-full bg-yakkihou-ng" />
        {ng}
      </span>
    </div>
  );
}
