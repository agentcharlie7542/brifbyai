'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Save,
  X,
  XCircle,
} from 'lucide-react';
import type { StructuredOrientSheet } from '@/lib/pdf-parser';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'cosmetic', label: '화장품' },
  { value: 'quasi_drug', label: '의약부외품' },
  { value: 'health_food', label: '건강식품' },
  { value: 'functional_food', label: '기능성표시식품' },
  { value: 'general_food', label: '일반식품' },
  { value: 'medical_device', label: '의료기기' },
  { value: 'general', label: '일반' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

export interface Finding {
  text: string;
  level: 'WARN' | 'NG';
  rule: string;
  reason: string;
  suggestions: string[];
}

interface SheetSnapshot {
  id: string;
  brandId: string;
  brandName: string;
  campaignName: string;
  category: string;
  targetMarket: string;
  createdAt: string;
  content: StructuredOrientSheet;
  yakkihouSummary: {
    safe: number;
    warn: number;
    ng: number;
    findings?: Finding[];
  } | null;
}

function findingsFor(text: string | undefined, all: Finding[]): Finding[] {
  if (!text) return [];
  return all.filter((f) => text.includes(f.text));
}

export function SheetView({ initial }: { initial: SheetSnapshot }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  // 편집 상태 — 진입 시 초기값 클론
  const [campaignName, setCampaignName] = useState(initial.campaignName);
  const [category, setCategory] = useState<CategoryValue>(
    initial.category as CategoryValue
  );
  const [draft, setDraft] = useState<StructuredOrientSheet>(initial.content);

  function startEdit() {
    setCampaignName(initial.campaignName);
    setCategory(initial.category as CategoryValue);
    setDraft(initial.content);
    setSaveError(null);
    setEditing(true);
  }
  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function save() {
    setSaveError(null);
    try {
      const res = await fetch(`/api/sheets/${initial.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: draft,
          campaignName,
          category,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(json.detail || json.error || `HTTP ${res.status}`);
        return;
      }
      setEditing(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'save failed');
    }
  }

  const findings = initial.yakkihouSummary?.findings ?? [];

  // ── 보기 모드 ───────────────────────────────────────────────
  if (!editing) {
    const c = initial.content;
    return (
      <>
        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {initial.campaignName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {initial.brandName} · {labelCategory(initial.category)} ·{' '}
              {initial.targetMarket.toUpperCase()} ·{' '}
              {new Date(initial.createdAt).toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {initial.yakkihouSummary ? (
              <YakkihouBadge summary={initial.yakkihouSummary} />
            ) : null}
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm hover:bg-accent"
            >
              <Pencil className="mr-1 h-3 w-3" />
              편집
            </button>
          </div>
        </header>

        <div className="mt-10 space-y-6">
          {c.campaign ? (
            <Section title="캠페인">
              <KV label="이름">{c.campaign.name}</KV>
              <KV label="목적">{c.campaign.purpose}</KV>
              <KV label="기간">{c.campaign.period}</KV>
            </Section>
          ) : null}

          {c.product ? (
            <Section title="제품">
              <KV label="제품명">{c.product.name}</KV>
              <KV label="제품명(JA)">{c.product.nameJa}</KV>
              <KV label="가격">{c.product.price}</KV>
              <KV label="카테고리">{c.product.category}</KV>
              <KV label="타겟 마켓">{c.product.targetMarket}</KV>
              {c.product.qoo10Url ? (
                <div className="col-span-2">
                  <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Qoo10 URL
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={c.product.qoo10Url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      {c.product.qoo10Url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              ) : null}
              <List label="핵심 성분" items={c.product.keyIngredients} />
              <List label="승인 효능" items={c.product.approvedClaims} />
            </Section>
          ) : null}

          {c.target ? (
            <Section title="타겟·크리에이터">
              <KV label="오디언스" full>
                {c.target.audience}
              </KV>
              <KV label="크리에이터 페르소나" full>
                {c.target.creatorPersona}
              </KV>
            </Section>
          ) : null}

          {c.content ? (
            <Section title="콘텐츠 디렉션">
              <KV label="톤·스타일" full>
                {c.content.toneAndStyle}
              </KV>
              <List
                label="필수 메시지"
                items={c.content.requiredMessages}
                findings={findings}
                full
              />
              <List
                label="핵심 메시지"
                items={c.content.keyMessages}
                findings={findings}
                full
              />
              <List
                label="금지 표현"
                items={c.content.prohibitedExpressions}
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
                      const matches = findingsFor(cp, findings);
                      return (
                        <div key={i}>
                          <blockquote className="rounded-md border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-sm leading-relaxed">
                            {cp}
                            {matches.length > 0 ? (
                              <span className="ml-2 inline-flex gap-1 align-middle">
                                {matches.map((m, j) => (
                                  <FindingBadge key={j} finding={m} />
                                ))}
                              </span>
                            ) : null}
                          </blockquote>
                          {matches.length > 0 ? (
                            <FindingDetail findings={matches} />
                          ) : null}
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

          {c.sentenceHints && c.sentenceHints.length > 0 ? (
            <Section title="문장별 약기법 힌트 (Claude 자가 라벨링)">
              <div className="col-span-2 space-y-2">
                {c.sentenceHints.map((s, i) => (
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

          {c.notes ? (
            <Section title="기타 메모">
              <p className="col-span-2 whitespace-pre-line text-sm leading-relaxed">
                {c.notes}
              </p>
            </Section>
          ) : null}
        </div>
      </>
    );
  }

  // ── 편집 모드 ───────────────────────────────────────────────
  return (
    <>
      <header className="mt-2 flex items-start justify-between">
        <div className="flex-1">
          <input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-2xl font-bold tracking-tight"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {initial.brandName} · 편집 중
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm hover:bg-accent disabled:opacity-50"
          >
            <X className="mr-1 h-3 w-3" />
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !campaignName.trim()}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1 h-3 w-3" />
            )}
            저장 + 약기법 재검증
          </button>
        </div>
      </header>

      {saveError ? (
        <div className="mt-4 rounded-md border border-yakkihou-ng/30 bg-yakkihou-ng/5 p-3 text-xs">
          <p className="font-medium text-yakkihou-ng">저장 실패</p>
          <p className="mt-0.5 break-all text-foreground/80">{saveError}</p>
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        <EditSection title="기본 정보">
          <EditRow label="카테고리 (약기법 룰셋)">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryValue)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </EditRow>
        </EditSection>

        <EditSection title="캠페인">
          <EditRow label="캠페인 이름">
            <TextField
              value={draft.campaign?.name ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  campaign: { ...draft.campaign, name: v },
                })
              }
            />
          </EditRow>
          <EditRow label="목적">
            <TextArea
              value={draft.campaign?.purpose ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  campaign: { ...draft.campaign, purpose: v },
                })
              }
              rows={2}
            />
          </EditRow>
          <EditRow label="기간">
            <TextField
              value={draft.campaign?.period ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  campaign: { ...draft.campaign, period: v },
                })
              }
            />
          </EditRow>
        </EditSection>

        <EditSection title="제품">
          <EditRow label="제품명">
            <TextField
              value={draft.product?.name ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  product: { ...draft.product, name: v },
                })
              }
            />
          </EditRow>
          <EditRow label="제품명 (일본어)">
            <TextField
              value={draft.product?.nameJa ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  product: { ...draft.product, nameJa: v },
                })
              }
            />
          </EditRow>
          <EditRow label="핵심 성분 (한 줄에 하나)">
            <ListField
              value={draft.product?.keyIngredients ?? []}
              onChange={(arr) =>
                setDraft({
                  ...draft,
                  product: { ...draft.product, keyIngredients: arr },
                })
              }
            />
          </EditRow>
          <EditRow label="승인 효능 (한 줄에 하나)">
            <ListField
              value={draft.product?.approvedClaims ?? []}
              onChange={(arr) =>
                setDraft({
                  ...draft,
                  product: { ...draft.product, approvedClaims: arr },
                })
              }
            />
          </EditRow>
        </EditSection>

        <EditSection title="타겟·크리에이터">
          <EditRow label="오디언스">
            <TextArea
              value={draft.target?.audience ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  target: { ...draft.target, audience: v },
                })
              }
              rows={2}
            />
          </EditRow>
          <EditRow label="크리에이터 페르소나">
            <TextArea
              value={draft.target?.creatorPersona ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  target: { ...draft.target, creatorPersona: v },
                })
              }
              rows={2}
            />
          </EditRow>
        </EditSection>

        <EditSection title="콘텐츠 디렉션">
          <EditRow label="톤·스타일">
            <TextArea
              value={draft.content?.toneAndStyle ?? ''}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  content: { ...draft.content, toneAndStyle: v },
                })
              }
              rows={3}
            />
          </EditRow>
          <EditRow label="필수 메시지">
            <ListField
              value={draft.content?.requiredMessages ?? []}
              findings={findings}
              onChange={(arr) =>
                setDraft({
                  ...draft,
                  content: { ...draft.content, requiredMessages: arr },
                })
              }
            />
          </EditRow>
          <EditRow label="핵심 메시지">
            <ListField
              value={draft.content?.keyMessages ?? []}
              findings={findings}
              onChange={(arr) =>
                setDraft({
                  ...draft,
                  content: { ...draft.content, keyMessages: arr },
                })
              }
            />
          </EditRow>
          <EditRow label="금지 표현">
            <ListField
              value={draft.content?.prohibitedExpressions ?? []}
              findings={findings}
              onChange={(arr) =>
                setDraft({
                  ...draft,
                  content: { ...draft.content, prohibitedExpressions: arr },
                })
              }
            />
          </EditRow>
          <EditRow label="샘플 카피">
            <ListField
              value={draft.content?.sampleCopy ?? []}
              findings={findings}
              onChange={(arr) =>
                setDraft({
                  ...draft,
                  content: { ...draft.content, sampleCopy: arr },
                })
              }
            />
          </EditRow>
        </EditSection>

        <EditSection title="메모">
          <EditRow label="기타 메모">
            <TextArea
              value={draft.notes ?? ''}
              onChange={(v) => setDraft({ ...draft, notes: v })}
              rows={4}
            />
          </EditRow>
        </EditSection>

        <p className="text-xs text-muted-foreground">
          저장하면 본문에 대해 약기법 룰셋(Layer 1+2)이 재실행되어 SAFE/WARN/NG 카운트가 갱신됩니다.
        </p>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// 보기 모드 헬퍼
// ──────────────────────────────────────────────────────────────
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
            const matches = findingsFor(it, findings ?? []);
            return (
              <li key={i}>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground">·</span>
                  <span className="flex-1">
                    {it}
                    {matches.length > 0 ? (
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        {matches.map((m, j) => (
                          <FindingBadge key={j} finding={m} />
                        ))}
                      </span>
                    ) : null}
                  </span>
                </div>
                {matches.length > 0 ? (
                  <FindingDetail findings={matches} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </dd>
    </div>
  );
}

function FindingBadge({ finding }: { finding: Finding }) {
  const tone =
    finding.level === 'NG'
      ? 'bg-yakkihou-ng text-white'
      : 'bg-yakkihou-warn text-white';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
        tone
      )}
      title={finding.reason}
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

function YakkihouBadge({
  summary,
}: {
  summary: { safe: number; warn: number; ng: number };
}) {
  return (
    <div className="flex gap-2 text-xs">
      <Pill
        tone="safe"
        label="SAFE"
        count={summary.safe}
        icon={<CheckCircle2 className="h-3 w-3" />}
      />
      <Pill
        tone="warn"
        label="WARN"
        count={summary.warn}
        icon={<AlertTriangle className="h-3 w-3" />}
      />
      <Pill
        tone="ng"
        label="NG"
        count={summary.ng}
        icon={<XCircle className="h-3 w-3" />}
      />
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

// ──────────────────────────────────────────────────────────────
// 편집 모드 헬퍼
// ──────────────────────────────────────────────────────────────
function EditSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function EditRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TextField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    />
  );
}

function ListField({
  value,
  onChange,
  findings = [],
}: {
  value: string[];
  onChange: (v: string[]) => void;
  findings?: Finding[];
}) {
  function updateAt(i: number, v: string) {
    const next = value.slice();
    next[i] = v;
    onChange(next);
  }
  function removeAt(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }
  function addRow() {
    onChange([...value, '']);
  }

  return (
    <div className="space-y-1.5">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">(비어있음)</p>
      ) : null}
      {value.map((item, i) => {
        const matches = findingsFor(item, findings);
        return (
          <div key={i}>
            <div className="flex items-start gap-2">
              <input
                value={item}
                onChange={(e) => updateAt(i, e.target.value)}
                className={cn(
                  'flex-1 rounded-md border bg-background px-3 py-2 text-sm',
                  matches.some((m) => m.level === 'NG')
                    ? 'border-yakkihou-ng/50 bg-yakkihou-ng/5'
                    : matches.some((m) => m.level === 'WARN')
                      ? 'border-yakkihou-warn/50 bg-yakkihou-warn/5'
                      : 'border-input'
                )}
              />
              {matches.length > 0 ? (
                <div className="flex items-center gap-1 pt-1.5">
                  {matches.map((m, j) => (
                    <FindingBadge key={j} finding={m} />
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => removeAt(i)}
                title="삭제"
                className="rounded-md border border-input bg-background p-2 text-muted-foreground hover:bg-accent"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {matches.length > 0 ? <FindingDetail findings={matches} /> : null}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRow}
        className="text-xs text-primary hover:underline"
      >
        + 줄 추가
      </button>
    </div>
  );
}
