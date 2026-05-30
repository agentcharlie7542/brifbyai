export type SocialPlatform = 'youtube' | 'instagram' | 'tiktok';

export interface SocialPost {
  title?: string;
  caption?: string;
  tags?: string[];
  url?: string;
  publishedAt?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
}

export interface SocialProfile {
  platform: SocialPlatform;
  handle: string;
  displayName?: string;
  url?: string;
  bio?: string;
  followerCount?: number;
  posts: SocialPost[];
  /** 데이터 출처 — 신뢰도/디버깅용 */
  source: 'youtube_api' | 'manual';
  fetchedAt: string;
}
