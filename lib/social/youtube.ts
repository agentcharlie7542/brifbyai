/**
 * YouTube Data API v3 로 채널 + 최근 영상 수집 → SocialProfile.
 *
 * YOUTUBE_API_KEY 환경변수 필요 (Google Cloud Console → YouTube Data API v3).
 * 키가 없으면 명확한 에러를 던져 호출자가 수동 입력으로 폴백하게 한다.
 *
 * 지원 입력:
 *   https://www.youtube.com/@handle
 *   https://www.youtube.com/channel/UCxxxx
 *   https://www.youtube.com/user/username   (레거시)
 *   @handle / UCxxxx / 일반 핸들 문자열
 */
import type { SocialProfile, SocialPost } from './types';

const API = 'https://www.googleapis.com/youtube/v3';

export class YouTubeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeFetchError';
  }
}

type ChannelRef =
  | { type: 'id'; value: string }
  | { type: 'handle'; value: string }
  | { type: 'username'; value: string };

export function parseYouTubeRef(input: string): ChannelRef {
  const s = input.trim();

  // URL 형태
  const urlMatch = s.match(
    /youtube\.com\/(channel\/(UC[\w-]+)|user\/([\w-]+)|@([\w.\-]+)|c\/([\w.\-]+))/i
  );
  if (urlMatch) {
    if (urlMatch[2]) return { type: 'id', value: urlMatch[2] };
    if (urlMatch[3]) return { type: 'username', value: urlMatch[3] };
    if (urlMatch[4]) return { type: 'handle', value: urlMatch[4] };
    if (urlMatch[5]) return { type: 'handle', value: urlMatch[5] };
  }

  // 비-URL
  if (/^UC[\w-]{20,}$/.test(s)) return { type: 'id', value: s };
  if (s.startsWith('@')) return { type: 'handle', value: s.slice(1) };
  return { type: 'handle', value: s };
}

function num(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function ytGet(
  path: string,
  params: Record<string, string>,
  apiKey: string
): Promise<any> {
  const qs = new URLSearchParams({ ...params, key: apiKey }).toString();
  const res = await fetch(`${API}/${path}?${qs}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new YouTubeFetchError(
      `YouTube API ${path} 실패 (HTTP ${res.status}) ${body.slice(0, 200)}`
    );
  }
  return res.json();
}

export async function fetchYouTubeProfile(
  input: string,
  opts: { maxVideos?: number; apiKey?: string } = {}
): Promise<SocialProfile> {
  const apiKey = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YouTubeFetchError(
      'YOUTUBE_API_KEY 가 설정되지 않았습니다. 수동 입력을 사용하세요.'
    );
  }
  const maxVideos = Math.min(opts.maxVideos ?? 10, 25);
  const ref = parseYouTubeRef(input);

  const channelParams: Record<string, string> = {
    part: 'snippet,statistics,contentDetails',
  };
  if (ref.type === 'id') channelParams.id = ref.value;
  else if (ref.type === 'handle') channelParams.forHandle = ref.value;
  else channelParams.forUsername = ref.value;

  const channelData = await ytGet('channels', channelParams, apiKey);
  const channel = channelData.items?.[0];
  if (!channel) {
    throw new YouTubeFetchError(
      `채널을 찾지 못했습니다: ${input} (핸들/URL 확인)`
    );
  }

  const uploadsPlaylist =
    channel.contentDetails?.relatedPlaylists?.uploads as string | undefined;

  let posts: SocialPost[] = [];
  if (uploadsPlaylist) {
    const pl = await ytGet(
      'playlistItems',
      {
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylist,
        maxResults: String(maxVideos),
      },
      apiKey
    );
    const videoIds: string[] = (pl.items ?? [])
      .map((it: any) => it.contentDetails?.videoId)
      .filter(Boolean);

    // 영상 통계 배치 조회
    const statsById = new Map<string, any>();
    if (videoIds.length > 0) {
      const vids = await ytGet(
        'videos',
        { part: 'statistics,snippet', id: videoIds.join(',') },
        apiKey
      );
      for (const v of vids.items ?? []) statsById.set(v.id, v);
    }

    posts = (pl.items ?? []).map((it: any): SocialPost => {
      const vid = it.contentDetails?.videoId;
      const sn = it.snippet ?? {};
      const v = vid ? statsById.get(vid) : undefined;
      const tags: string[] | undefined = v?.snippet?.tags;
      return {
        title: sn.title,
        caption: (v?.snippet?.description ?? sn.description ?? '').slice(0, 800),
        tags: tags?.slice(0, 15),
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : undefined,
        publishedAt: sn.publishedAt,
        metrics: {
          views: num(v?.statistics?.viewCount),
          likes: num(v?.statistics?.likeCount),
          comments: num(v?.statistics?.commentCount),
        },
      };
    });
  }

  const handle =
    channel.snippet?.customUrl?.replace(/^@/, '') ||
    (ref.type === 'handle' ? ref.value : channel.id);

  return {
    platform: 'youtube',
    handle,
    displayName: channel.snippet?.title,
    url: `https://www.youtube.com/channel/${channel.id}`,
    bio: (channel.snippet?.description ?? '').slice(0, 1000) || undefined,
    followerCount: num(channel.statistics?.subscriberCount),
    posts,
    source: 'youtube_api',
    fetchedAt: new Date().toISOString(),
  };
}
