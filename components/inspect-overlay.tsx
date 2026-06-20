'use client';

/**
 * 캡쳐 이미지 1장 위에 약기법 finding 이 있는 블록의 bbox 를 색 박스로 오버레이.
 * 박스 클릭 → 이유 + 권장 대체표현 팝오버. 좌표는 0~1 정규화라 표시 크기와 무관.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { InspectBlock, ScanImage, YakkihouLevel } from '@/lib/inspect/types';

function boxClass(level: YakkihouLevel): string {
  if (level === 'NG') return 'border-yakkihou-ng bg-yakkihou-ng/15 hover:bg-yakkihou-ng/25';
  if (level === 'WARN')
    return 'border-yakkihou-warn bg-yakkihou-warn/15 hover:bg-yakkihou-warn/25';
  return 'border-yakkihou-safe bg-yakkihou-safe/10';
}

export function InspectOverlay({
  image,
  blocks,
  imageIndex,
}: {
  image: ScanImage;
  blocks: InspectBlock[];
  imageIndex: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  // 이 이미지의 블록 중 finding 이 있는 것만 박스로
  const flagged = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.imageIndex === imageIndex && b.findings.length > 0);

  return (
    <div className="relative w-full select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.dataUrl}
        alt={`상세 캡쳐 ${imageIndex + 1}`}
        className="block w-full rounded-md border"
      />
      {flagged.map(({ b, i }) => (
        <button
          key={i}
          type="button"
          onClick={() => setActive(active === i ? null : i)}
          title={b.findings[0]?.reason}
          className={cn(
            'absolute rounded-sm border-2 transition-colors',
            boxClass(b.level)
          )}
          style={{
            left: `${b.bbox.x * 100}%`,
            top: `${b.bbox.y * 100}%`,
            width: `${b.bbox.w * 100}%`,
            height: `${b.bbox.h * 100}%`,
          }}
        >
          <span
            className={cn(
              'absolute -top-2 -left-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white',
              b.level === 'NG' ? 'bg-yakkihou-ng' : 'bg-yakkihou-warn'
            )}
          >
            {b.level === 'NG' ? 'NG' : '!'}
          </span>
        </button>
      ))}

      {active !== null && blocks[active] ? (
        <div
          role="dialog"
          className="absolute z-20 w-72 max-w-[90%] rounded-md border bg-card p-3 text-left text-xs shadow-lg"
          style={{
            left: `${Math.min(blocks[active].bbox.x, 0.7) * 100}%`,
            top: `${Math.min(blocks[active].bbox.y + blocks[active].bbox.h, 0.92) * 100}%`,
          }}
        >
          <div className="mb-1 flex items-center justify-between">
            <LevelBadge level={blocks[active].level} />
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <p className="mb-2 font-medium text-foreground">{blocks[active].text}</p>
          <ul className="space-y-2">
            {blocks[active].findings.map((f, j) => (
              <li key={j} className="border-t pt-2 first:border-t-0 first:pt-0">
                <p className="text-foreground">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {f.text}
                  </span>{' '}
                  — {f.reason}
                </p>
                {f.suggestions.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {f.suggestions.map((s, k) => (
                      <span
                        key={k}
                        className="rounded-full border border-yakkihou-safe/40 bg-yakkihou-safe/10 px-2 py-0.5 text-yakkihou-safe"
                      >
                        → {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function LevelBadge({ level }: { level: YakkihouLevel }) {
  const map = {
    SAFE: 'bg-yakkihou-safe/15 text-yakkihou-safe',
    WARN: 'bg-yakkihou-warn/15 text-yakkihou-warn',
    NG: 'bg-yakkihou-ng/15 text-yakkihou-ng',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex h-5 w-12 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
        map[level]
      )}
    >
      {level}
    </span>
  );
}
