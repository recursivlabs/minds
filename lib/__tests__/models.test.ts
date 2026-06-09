import { describe, it, expect } from 'vitest';
import {
  postScore, postReplyCount, postRepostCount, postUserVote,
  profileFollowerCount, profileFollowingCount, profilePostCount,
  conversationUnreadCount, timestampOf, isAiActor,
} from '../models';

describe('post accessors', () => {
  it('reads score across field-name variants', () => {
    expect(postScore({ score: 5 })).toBe(5);
    expect(postScore({ vote_count: 3 })).toBe(3);
    expect(postScore({ voteCount: 2 })).toBe(2);
    expect(postScore({})).toBe(0);
    expect(postScore(null)).toBe(0);
  });
  it('reads reply + repost counts (the fields that had bugs)', () => {
    expect(postReplyCount({ reply_count: 4 })).toBe(4);
    expect(postReplyCount({ replyCount: 1 })).toBe(1);
    expect(postRepostCount({ reposts_count: 7 })).toBe(7);
    expect(postRepostCount({ repostsCount: 2 })).toBe(2);
    expect(postRepostCount({})).toBe(0);
  });
  it('normalizes user vote to a valid union or null', () => {
    expect(postUserVote({ user_reaction: 'upvote' })).toBe('upvote');
    expect(postUserVote({ userVote: 'downvote' })).toBe('downvote');
    expect(postUserVote({ user_reaction: 'weird' })).toBeNull();
    expect(postUserVote({})).toBeNull();
  });
});

describe('profile accessors', () => {
  it('reads follower count (regression: follower_count vs followers_count)', () => {
    expect(profileFollowerCount({ followers_count: 9 })).toBe(9); // canonical API shape
    expect(profileFollowerCount({ followerCount: 3 })).toBe(3);
    expect(profileFollowerCount({ follower_count: 1 })).toBe(1);
    expect(profileFollowerCount({})).toBe(0);
  });
  it('reads following + post counts', () => {
    expect(profileFollowingCount({ following_count: 5 })).toBe(5);
    expect(profilePostCount({ posts_count: 12 })).toBe(12);
  });
});

describe('conversation + common accessors', () => {
  it('reads unread count', () => {
    expect(conversationUnreadCount({ unread_count: 2 })).toBe(2);
    expect(conversationUnreadCount({ unreadCount: 1 })).toBe(1);
    expect(conversationUnreadCount({})).toBe(0);
  });
  it('timestampOf tolerates snake/camel and missing', () => {
    expect(timestampOf({ created_at: '2026-01-01T00:00:00Z' })).toBe('2026-01-01T00:00:00Z');
    expect(timestampOf({ createdAt: '2026-02-01T00:00:00Z' })).toBe('2026-02-01T00:00:00Z');
    expect(timestampOf({})).toBe('');
  });
  it('isAiActor detects agents across shapes', () => {
    expect(isAiActor({ is_ai: true })).toBe(true);
    expect(isAiActor({ isAi: true })).toBe(true);
    expect(isAiActor({ type: 'agent' })).toBe(true);
    expect(isAiActor({ user: { is_ai: true } })).toBe(true);
    expect(isAiActor({ name: 'human' })).toBe(false);
  });
});
