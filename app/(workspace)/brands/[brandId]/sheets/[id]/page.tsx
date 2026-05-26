import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { getBrand } from '@/lib/db/repositories/brands';
import { getSheet } from '@/lib/db/repositories/sheets';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function SheetDetailPage({
  params,
}: {
  params: { brandId: string; id: string };
}) {
  noStore();
  const [brand, sheet] = await Promise.all([
    getBrand(params.brandId),
    getSheet(params.id),
  ]);
  if (!brand || !sheet || sheet.brandId !== brand.id) notFound();

  const content = (sheet.content ?? {}) as StructuredOrientSheet;

  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/brands/${brand.id}/sheets`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {brand.name} · 시트 목록
        </Link>

        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {sheet.campaignName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand.name} · {labelCategory(sheet.category)} · {sheet.targetMarket.toUpperCase()} ·{' '}
              {new Date(sheet.createdAt).toLocaleString('ko-KR')}
            </p>
          </div>
          {sheet.yakkihouSummary ? (
            <YakkihouBadge summary={sheet.yakkihouSummary} />
          ) : null}
        </header>

        <div className="mt-10 space-y-6">
          {content.campaign ? (
            <Section title="캠페인">
              <KV label="이름">{content.campaign.name}</KV>
              <KV label="목적">{content.campaign.purpose}</KV>
              <KV label="기간">{content.campaign.period}</KV>
            </Section>
          ) : null}

          {content.product ? (
            <Section title="제품">
              <KV label="제품명">{content.product.name}</KV>
              <KV label="제품명(JA)">{content.product.nameJa}</KV>
              <KV label="가격">{content.product.price}</KV>
              <KV label="카테고리">{content.product.category}</KV>
              <KV label="타겟 마켓">{content.product.targetMarket}</KV>
              {content.product.qoo10Url ? (
                <div className="col-span-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Qoo10 URL
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={content.product.qoo10Url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {content.product.qoo10Url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              ) : null}
              <List label="핵심 성분" items={content.product.keyIngredients} />
              <List label="승인 효능" items={content.product.approvedClaims} />
            </Section>
          ) : null}

          {content.target ? (
            <Section title="타겟·크리에이터">
              <KV label="오디언스" full>
                {content.target.audience}
              </KV>
              <KV label="크리에이터 페르소나" full>
                {content.target.creatorPersona}
              </KV>
            </Section>
          ) : null}

          {content.content ? (
            <Section title="콘텐츠 디렉션">
              <KV label="톤·스타일" full>
                {content.content.toneAndStyle}
              </KV>
              <List label="필수 메시지" items={content.content.requiredMessages} full />
              <List label="핵심 메시지" items={content.content.keyMessages} full />
              <List
                label="금지 표현"
                items={content.content.prohibitedExpressions}
                full
              />
              {content.content.sampleCopy && content.content.sampleCopy.length > 0 ? (
                <div className="col-span-2 space-y-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    샘플 카피
                  </dt>
                  <dd className="space-y-2">
                    {content.content.sampleCopy.map((c, i) => (
                      <blockquote
                        key={i}
                        className="rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm leading-relaxed"
                      >
                        {c}
                      </blockquote>
                    ))}
                  </dd>
                </div>
              ) : null}
            </Section>
          ) : null}

          {content.ops ? (
            <Section title="운영">
              <List label="채널" items={content.ops.channels} />
              <List label="해시태그" items={content.ops.hashtags} />
              <KV label="KPI">{content.ops.kpi}</KV>
              <KV label="마감">{content.ops.deadline}</KV>
            </Section>
          ) : null}

          {content.sentenceHints && content.sentenceHints.length > 0 ? (
            <Section title="문장별 약기법 힌트 (Claude 자가 라벨링)">
              <div className="col-span-2 space-y-2">
                {content.sentenceHints.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <HintBadge hint={s.hint} />
                    <div className="flex-1">
                      <p>{s.text}</p>
                      {s.note ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {content.notes ? (
            <Section title="기타 메모">
              <p className="col-span-2 whitespace-pre-line text-sm leading-relaxed">
                {content.notes}
              </p>
            </Section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function labelCategory(c: string) {
  const map: Record<string, string> = {
    cosmetic: '화장품',
    quasi_drug: '의약부외품',
    health_food: '건강식품',
    functional_food: '기능성표시식품',
    general_food: '일반식품',
    medical_device: '의료기기',
    general: '일반',
  };
  return map[c] ?? c;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">{children}</dl>
    </section>
  );
}

function KV({
  label,
  children,
  full,
}: {
  label: string;
  children?: React.ReactNode;
  full?: boolean;
}) {
  if (children == null || children === '') return null;
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm">{children}</dd>
    </div>
  );
}

function List({
  label,
  items,
  full,
}: {
  label: string;
  items?: string[];
  full?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">
        <ul className="space-y-1 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-muted-foreground">·</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

function YakkihouBadge({
  summary,
}: {
  summary: { safe: number; warn: number; ng: number };
}) {
  return (
    <div className="flex gap-2 text-xs">
      <Pill tone="safe" label="SAFE" count={summary.safe} icon={<CheckCircle2 className="h-3 w-3" />} />
      <Pill tone="warn" label="WARN" count={summary.warn} icon={<AlertTriangle className="h-3 w-3" />} />
      <Pill tone="ng" label="NG" count={summary.ng} icon={<XCircle className="h-3 w-3" />} />
    </div>
  );
}

function Pill({
  tone,
  label,
  count,
  icon,
}: {
  tone: 'safe' | 'warn' | 'ng';
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  const tones = {
    safe: 'bg-yakkihou-safe/10 text-yakkihou-safe border-yakkihou-safe/30',
    warn: 'bg-yakkihou-warn/10 text-yakkihou-warn border-yakkihou-warn/30',
    ng: 'bg-yakkihou-ng/10 text-yakkihou-ng border-yakkihou-ng/30',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        tones[tone]
      )}
    >
      {icon}
      {label} {count}
    </span>
  );
}

function HintBadge({ hint }: { hint: 'SAFE' | 'WARN' | 'NG' }) {
  const conf =
    hint === 'NG'
      ? { tone: 'text-yakkihou-ng bg-yakkihou-ng/10', label: 'NG' }
      : hint === 'WARN'
        ? { tone: 'text-yakkihou-warn bg-yakkihou-warn/10', label: 'WARN' }
        : { tone: 'text-yakkihou-safe bg-yakkihou-safe/10', label: 'SAFE' };
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
        conf.tone
      )}
    >
      {conf.label}
    </span>
  );
}
