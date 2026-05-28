// Helpers for ensuring a personal agent has DM'd the user their intro
// message at least once. Used by:
//   - app/agent.tsx (post on first-time setup)
//   - app/(tabs)/chat.tsx back-fill (post on first chat-tab visit if
//     setup completed before this code shipped + intro was lost)
//
// Idempotent — only posts when the agent thread has zero agent-authored
// messages. Caller is responsible for invalidating the conversations
// cache afterwards so the Recent sidebar refetches.

export const INTRO_DM_TEMPLATE = (firstName: string): string => [
  `Hey ${firstName || 'there'}, I'm your personal AI agent on Minds.`,
  '',
  'I curate your "For You" feed by learning your preferences and finding you the best content across Minds and the full internet each day.',
  '',
  'I can perform scheduled tasks or reminders, help you write new posts, answer questions about Minds, teach you about your engagement patterns, or talk about anything you want really.',
  '',
  "Our conversation is private between us and doesn't train any models. You can change my name, model, or personality anytime in settings. You are free to disable me anytime.",
  '',
  "Let me know where you'd like to start.",
].join('\n');

export function firstName(name: string | null | undefined): string {
  if (!name) return 'there';
  return name.trim().split(/\s+/)[0] || 'there';
}

/**
 * Ensure a personal agent's DM thread has at least one agent-authored
 * message. No-ops if the thread already has one. Returns the
 * conversation id when present so callers can route the user into it.
 */
export async function ensureIntroDM(
  sdk: any,
  agentId: string,
  userName: string | null | undefined,
): Promise<string | null> {
  if (!sdk || !agentId) return null;
  const dmRes: any = await sdk.chat.dm({ user_id: agentId });
  const conversationId: string | undefined = dmRes?.data?.id;
  if (!conversationId) return null;
  try {
    const existing: any = await sdk.chat.messages?.(conversationId, { limit: 50 });
    const messages: Array<{ author?: { id?: string; is_ai?: boolean; isAi?: boolean } }> = existing?.data ?? [];
    const alreadyPosted = messages.some(
      (m) => m.author?.id === agentId || m.author?.is_ai === true || m.author?.isAi === true,
    );
    if (alreadyPosted) return conversationId;
    await sdk.chat.sendAsAgent({
      agent_id: agentId,
      conversation_id: conversationId,
      content: INTRO_DM_TEMPLATE(firstName(userName)),
    });
  } catch (err) {
    console.warn('[ensureIntroDM] failed to post intro', err);
    throw err;
  }
  return conversationId;
}
