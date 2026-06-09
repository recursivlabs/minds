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
