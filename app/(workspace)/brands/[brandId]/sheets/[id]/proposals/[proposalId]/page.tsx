import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { getBrand } from '@/lib/db/repositories/brands';
import { getSheet } from '@/lib/db/repositories/sheets';
import {
  getProposal,
  getInfluencer,
} from '@/lib/db/repositories/influencers';
import type { InfluencerProposalContent } from '@/lib/influencer/proposal';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface Finding {
  text: string;
  level: 'WARN' | 'NG';
  rule: string;
  reason: string;
  suggestions: string[];
}

export default async function ProposalPage({
  params,
}: {
  params: { brandId: string; id: string; proposalId: string };
}) {
  noStore();
  const [brand, sheet, proposal] = await Promise.all([
    getBrand(params.brandId),
    getSheet(params.id),
    getProposal(params.proposalId),
  ]);
  if (
    !brand ||
    !sheet ||
    !proposal ||
    sheet.brandId !== brand.id ||
    proposal.sheetId !== sheet.id
  ) {
    notFound();
  }

  const influencer = await getInfluencer(proposal.influencerId);
  const c = proposal.content as InfluencerProposalContent;
  const summary = proposal.yakkihouSummary;
  const findings: Finding[] = summary?.findings ?? [];

  return (
    <main className="px-10 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/brands/${brand.id}/sheets/${sheet.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {sheet.campaignName} · 표준 시트로
        </Link>

        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {influencer?.displayName || influencer?.handle || '맞춤 제안'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {influencer ? `${influencer.platform} · @${influencer.handle}` : ''}
              {' · '}
              {sheet.campaignName} 맞춤 제안
            </p>
          </div>
          {summary ? (
            <div className="flex gap-2 text-xs">
              <Badge tone="safe">SAFE {summary.safe}</Badge>
              <Badge tone="warn">WARN {summary.warn}</Badge>
              <Badge tone="ng">NG {summary.ng}</Badge>
            </div>
          ) : null}
        </header>

        <div className="mt-10 space-y-6">
          {c.influencerFit ? (
            <Section title="인플루언서 적합도·실행 가이드">
              <KV label="적합 이유" full>
                {c.influencerFit.rationale}
              </KV>
              <KV label="추천 포맷">{c.influencerFit.recommendedFormat}</KV>
              <List label="도입부 후크" items={c.influencerFit.hooks} full />
              <List label="게시 팁" items={c.influencerFit.postingTips} full />
              <List label="리스크·주의" items={c.influencerFit.risks} full />
            </Section>
          ) : null}

          {c.content ? (
            <Section title="콘텐츠 디렉션 (인플루언서 보이스)">
              <KV label="톤·스타일" full>
                {c.content.toneAndStyle}
              </KV>
              <List
                label="핵심 메시지"
                items={c.content.keyMessages}
                findings={findings}
                full
              />
              <List
                label="필수 메시지"
                items={c.content.requiredMessages}
                findings={findings}
                full
              />
              {c.content.sampleCopy && c.content.sampleCopy.length > 0 ? (
                <div className="col-span-2 space-y-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    샘플 카피
                  </dt>
                  <dd className="space-y-2">
                    {c.content.sampleCopy.map((cp, i) => {
                      const m = findingsFor(cp, findings);
                      return (
                        <div key={i}>
                          <blockquote className="rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                            {cp}
                            {m.length > 0 ? (
                              <span className="ml-2 inline-flex gap-1 align-middle">
                                {m.map((f, j) => (
                                  <FindingBadge key={j} finding={f} />
                                ))}
                              </span>
                            ) : null}
                          </blockquote>
                          {m.length > 0 ? <FindingDetail findings={m} /> : null}
                        </div>
                      );
                    })}
                  </dd>
                </div>
              ) : null}
            </Section>
          ) : null}

          {c.ops ? (
            <Section title="운영">
              <List label="채널" items={c.ops.channels} />
              <List label="해시태그" items={c.ops.hashtags} />
              <KV label="KPI">{c.ops.kpi}</KV>
              <KV label="마감">{c.ops.deadline}</KV>
            </Section>
          ) : null}

          {c.notes ? (
            <Section title="기타 메모">
              <p className="col-span-2 whitespace-pre-line text-sm leading-relaxed">
                {c.notes}
              </p>
            </Section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function findingsFor(text: string | undefined, all: Finding[]): Finding[] {
  if (!text) return [];
  return all.filter((f) => text.includes(f.text));
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
  findings,
}: {
  label: string;
  items?: string[];
  full?: boolean;
  findings?: Finding[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">
        <ul className="space-y-1.5 text-sm">
          {items.map((it, i) => {
            const m = findingsFor(it, findings ?? []);
            return (
              <li key={i}>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground">·</span>
                  <span className="flex-1">
                    {it}
                    {m.length > 0 ? (
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        {m.map((f, j) => (
                          <FindingBadge key={j} finding={f} />
                        ))}
                      </span>
                    ) : null}
                  </span>
                </div>
                {m.length > 0 ? <FindingDetail findings={m} /> : null}
              </li>
            );
          })}
        </ul>
      </dd>
    </div>
  );
}

function FindingBadge({ finding }: { finding: Finding }) {
  return (
    <span
      title={finding.reason}
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white',
        finding.level === 'NG' ? 'bg-yakkihou-ng' : 'bg-yakkihou-warn'
      )}
    >
      {finding.level}
    </span>
  );
}

function FindingDetail({ findings }: { findings: Finding[] }) {
  return (
    <ul className="ml-4 mt-1 space-y-1 border-l-2 border-yakkihou-warn/40 pl-3 text-xs text-foreground/70">
      {findings.map((f, i) => (
        <li key={i}>
          <span
            className={cn(
              'mr-1 font-semibold',
              f.level === 'NG' ? 'text-yakkihou-ng' : 'text-yakkihou-warn'
            )}
          >
            [{f.level}]
          </span>
          {f.reason}
          {f.suggestions.length > 0 ? (
            <span className="ml-1 text-muted-foreground">
              → 대안: {f.suggestions.slice(0, 3).join(' / ')}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'safe' | 'warn' | 'ng';
  children: React.ReactNode;
}) {
  const tones = {
    safe: 'bg-yakkihou-safe/10 text-yakkihou-safe border-yakkihou-safe/30',
    warn: 'bg-yakkihou-warn/10 text-yakkihou-warn border-yakkihou-warn/30',
    ng: 'bg-yakkihou-ng/10 text-yakkihou-ng border-yakkihou-ng/30',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
