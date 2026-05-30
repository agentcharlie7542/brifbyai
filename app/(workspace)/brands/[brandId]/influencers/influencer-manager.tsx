'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Plus,
  Sparkles,
  Youtube,
  Instagram,
  Music2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Platform = 'youtube' | 'instagram' | 'tiktok';

interface InfluencerItem {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  followerCount: number | null;
  url: string | null;
  hasPersona: boolean;
  postsCount: number;
}

export function InfluencerManager({
  brandId,
  initial,
}: {
  brandId: string;
  initial: InfluencerItem[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{initial.length}명 등록됨</p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow"
        >
          <Plus className="mr-1 h-3 w-3" />
          인플루언서 추가
        </button>
      </div>

      {adding ? (
        <AddForm
          brandId={brandId}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}

      {initial.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          아직 등록된 인플루언서가 없습니다.
        </div>
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {initial.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <PlatformIcon platform={it.platform} />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {it.displayName || it.handle}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{it.handle}
                  {it.followerCount != null
                    ? ` · 팔로워 ${it.followerCount.toLocaleString()}`
                    : ''}
                  {` · 게시물 ${it.postsCount}`}
                </p>
              </div>
              {it.hasPersona ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-yakkihou-safe/10 px-2 py-0.5 text-[10px] font-medium text-yakkihou-safe">
                  <CheckCircle2 className="h-3 w-3" />
                  분석됨
                </span>
              ) : (
                <AnalyzeButton
                  influencerId={it.id}
                  onDone={() => router.refresh()}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddForm({
  brandId,
  onDone,
}: {
  brandId: string;
  onDone: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [source, setSource] = useState<'youtube' | 'manual'>('youtube');
  const [input, setInput] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [followerCount, setFollowerCount] = useState('');
  const [bio, setBio] = useState('');
  const [postsText, setPostsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 플랫폼 변경 시 youtube 만 자동수집 가능
  function changePlatform(p: Platform) {
    setPlatform(p);
    setSource(p === 'youtube' ? 'youtube' : 'manual');
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { brandId, platform, source };
      if (source === 'youtube') {
        body.input = input.trim();
      } else {
        body.handle = handle.trim();
        body.displayName = displayName.trim() || undefined;
        body.bio = bio.trim() || undefined;
        if (followerCount.trim()) {
          const n = Number(followerCount.replace(/[^\d]/g, ''));
          if (Number.isFinite(n)) body.followerCount = n;
        }
        const posts = postsText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((caption) => ({ caption }));
        if (posts.length > 0) body.posts = posts;
      }

      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.detail || json.error || `HTTP ${res.status}`);
        if (json.fallback === 'manual' && source === 'youtube') {
          setSource('manual');
        }
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex gap-2">
        {(['youtube', 'instagram', 'tiktok'] as Platform[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => changePlatform(p)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs',
              platform === p
                ? 'border-primary bg-primary/5 font-medium'
                : 'border-input text-muted-foreground'
            )}
          >
            <PlatformIcon platform={p} small />
            {p}
          </button>
        ))}
      </div>

      {source === 'youtube' ? (
        <div className="mt-4">
          <label className="text-xs font-medium">YouTube 핸들 또는 URL</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="@channel 또는 https://youtube.com/@channel"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            공식 API로 채널·최근 영상을 가져옵니다. (YOUTUBE_API_KEY 필요 · 실패 시 수동 입력)
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">핸들</label>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@username"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium">표시명</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">팔로워 수 (선택)</label>
            <input
              value={followerCount}
              onChange={(e) => setFollowerCount(e.target.value)}
              placeholder="예: 12000"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">소개 (선택)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">
              최근 게시물 캡션 (한 줄에 하나)
            </label>
            <textarea
              value={postsText}
              onChange={(e) => setPostsText(e.target.value)}
              rows={5}
              placeholder={'게시물 캡션을 한 줄에 하나씩 붙여넣으세요.\n분석 정확도를 위해 5개 이상 권장.'}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-3 break-all text-xs text-yakkihou-ng">{error}</p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={
            busy ||
            (source === 'youtube' ? !input.trim() : !handle.trim())
          }
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              등록·분석 중…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              등록 + 분석
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function AnalyzeButton({
  influencerId,
  onDone,
}: {
  influencerId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/influencers/${influencerId}/analyze`, {
            method: 'POST',
          });
          onDone();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center rounded-md border border-input bg-background px-2.5 py-1 text-[11px] shadow-sm hover:bg-accent disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="mr-1 h-3 w-3" />
      )}
      분석
    </button>
  );
}

function PlatformIcon({
  platform,
  small,
}: {
  platform: string;
  small?: boolean;
}) {
  const cls = small ? 'h-3.5 w-3.5' : 'h-4 w-4 text-muted-foreground';
  if (platform === 'youtube') return <Youtube className={cls} />;
  if (platform === 'instagram') return <Instagram className={cls} />;
  return <Music2 className={cls} />;
}
