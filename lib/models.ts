// Typed accessors for API/SDK response shapes.
//
// The API has historically returned a mix of snake_case and camelCase, and the
// app papered over it with inline `x.foo || x.foo_bar || 0` chains scattered
// across components. That drift caused real bugs (reading `follower_count` when
// the API returns `followers_count`, a missing `reposts_count`, etc.). These
// accessors centralize every field-name fallback in ONE tested place, so the
// shape is asserted by unit tests instead of guessed at each call site.

/** Loose shape: any API object. Accessors normalize the field-name drift. */
type Raw = Record<string, any> | null | undefined;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ── Posts ──
export function postScore(p: Raw): number {
  return num(p?.score ?? p?.vote_count ?? p?.voteCount);
}
export function postReplyCount(p: Raw): number {
  return num(p?.replyCount ?? p?.reply_count ?? p?.comments_count ?? p?.commentsCount);
}
export function postRepostCount(p: Raw): number {
  return num(p?.reposts_count ?? p?.repostsCount ?? p?.repost_count ?? p?.repostCount);
}
export function postUserVote(p: Raw): 'upvote' | 'downvote' | null {
  const v = p?.userReaction ?? p?.user_reaction ?? p?.userVote ?? p?.user_vote ?? null;
  return v === 'upvote' || v === 'downvote' ? v : null;
}

// ── Articles (X-style long-form) ──
// An article is a post with a title AND a markdown long-form body. Video posts
// also carry a title but stay content_format 'plain', so the markdown flag is
// what actually distinguishes an article from a titled post. The legacy blog
// import stamps exactly these fields on the ~2.4M migrated articles.
export function postContentFormat(p: Raw): string {
  return (p?.contentFormat ?? p?.content_format ?? 'plain').toString();
}
export function postTitle(p: Raw): string {
  const t = p?.title;
  return typeof t === 'string' ? t.trim() : '';
}
export function isArticlePost(p: Raw): boolean {
  return Boolean(postTitle(p)) && postContentFormat(p) === 'markdown';
}
/** First media URL (the article cover), tolerating array/object/string shapes. */
export function coverImageUrl(p: Raw): string | null {
  const raw = p?.media;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const m of arr) {
    const url = typeof m === 'string' ? m : m?.url;
    if (url) return String(url);
  }
  return p?.image || p?.thumbnail || null;
}
/** Plain-text excerpt from a markdown body (strip formatting), clamped. */
export function articleExcerpt(p: Raw, max = 180): string {
  const plain = (p?.content ?? '')
    .toString()
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}
/** Estimated reading time in minutes (~200 wpm), floored at 1. */
export function readingTimeMinutes(p: Raw): number {
  const words = (p?.content ?? '').toString().trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ── Profiles ──
export function profileFollowerCount(p: Raw): number {
  return num(p?.followersCount ?? p?.followers_count ?? p?.followerCount ?? p?.follower_count);
}
export function profileFollowingCount(p: Raw): number {
  return num(p?.followingCount ?? p?.following_count ?? p?.followingCount);
}
export function profilePostCount(p: Raw): number {
  return num(p?.postsCount ?? p?.posts_count ?? p?.postCount ?? p?.post_count);
}

// ── Conversations / unread ──
export function conversationUnreadCount(c: Raw): number {
  return num(c?.unreadCount ?? c?.unread_count);
}

// ── Common ──
/** Returns an ISO timestamp string, tolerating snake/camel and Date inputs. */
export function timestampOf(x: Raw): string {
  const t = x?.createdAt ?? x?.created_at ?? x?.updatedAt ?? x?.updated_at;
  if (!t) return '';
  return typeof t === 'string' ? t : new Date(t).toISOString();
}

/** True when the entity (user/agent) is an AI agent, across field-name variants. */
export function isAiActor(x: Raw): boolean {
  if (!x) return false;
  return Boolean(x.isAi ?? x.is_ai ?? x.user?.isAi ?? x.user?.is_ai)
    || x.type === 'agent'
    || x.user?.type === 'agent';
}

// ── Post dedup ──
// Orphaned legacy reminds carry the original's image with NO `reposted_from_id`,
// so the same photo repeats under different authors (the "john Untitled" noise
// on Discover/trending). We collapse by repost link OR a NORMALIZED media URL
// (strip query string + trailing slash, lowercase host) so CDN / cache-busting
// variants of one image collapse to a single key. `media` may be an array of
// {url}, a bare object, or a string — handle every shape.
export function normalizeMediaUrl(post: Raw): string | null {
  const raw = post?.media;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const m of arr) {
    const url = typeof m === 'string' ? m : m?.url;
    if (url) {
      try {
        const u = new URL(url);
        return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
      } catch {
        return String(url).split('?')[0].replace(/\/+$/, '').toLowerCase();
      }
    }
  }
  return null;
}

export function postDedupKey(post: Raw): string {
  return (
    post?.reposted_from_id ||
    post?.reposted_from?.id ||
    post?.repostedFromId ||
    post?.repostedFrom?.id ||
    normalizeMediaUrl(post) ||
    post?.id
  );
}

/**
 * Collapse reposts of the same original (and orphaned reminds sharing one image)
 * so a single viral post / remind chain can't fill a list. Keeps the first
 * occurrence — rank the list BEFORE calling this.
 */
export function dedupePosts<T extends Raw>(posts: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of posts || []) {
    const key = postDedupKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
