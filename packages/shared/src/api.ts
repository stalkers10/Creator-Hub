import type { PostType } from './constants';

/** Shape of every error returned by the API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  isCreator: boolean;
  isAdmin: boolean;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

/** Free daily viewing time, returned with the feed and by the usage endpoints. */
export interface QuotaStatus {
  /** True when the user has an active subscription (no limit applies). */
  unlimited: boolean;
  remainingSeconds: number | null;
  dailyLimitSeconds: number | null;
  /** When the free time comes back (ISO date string). */
  resetsAt: string | null;
}

export interface FeedPost {
  id: string;
  type: PostType;
  caption: string | null;
  textContent: string | null;
  createdAt: string;
  creator: { id: string; displayName: string; profilePicture: string | null };
  media: { url: string; mediaType: 'image' | 'video'; duration: number | null }[];
}

export interface FeedResponse {
  posts: FeedPost[];
  nextCursor: string | null;
  quota: QuotaStatus;
}
