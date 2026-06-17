import { ORG_ID } from './recursiv';
import { resolvePersonalAgent } from './resolvePersonalAgent';

// Opens the signed-in user's PERSONAL agent DM, seeds it with `prompt`, and
// navigates to the chat. Shared by the command palette ("/ask") and the
// per-post "Ask your agent about this" button (Grok-on-X style). The heavy
// LLM work happens server-side in the agent and is metered against the user's
// Minds+/Pro allowance — this is intentionally a paid, usage-driving surface.
export async function askAgent(sdk: any, router: any, prompt: string): Promise<void> {
  if (!sdk) return;
  try {
    const personal = await resolvePersonalAgent(sdk);
    // No personal agent yet → send them through setup; they can retry after.
    if (!personal) {
      router.push('/agent' as any);
      return;
    }
    const dm = await sdk.chat.dm({ user_id: personal.id, organization_id: ORG_ID || undefined } as any);
    const convoId = dm.data?.id;
    if (!convoId) return;
    // Send the prompt right away so the agent sees it on open (the DM screen
    // picks up the WS broadcast).
    try {
      await sdk.chat.send({ conversation_id: convoId, content: prompt });
    } catch {}
    router.push(`/(tabs)/chat?id=${convoId}` as any);
  } catch {}
}

// Builds the "give me context on this post" prompt from a post object.
export function buildPostContextPrompt(opts: { author?: string; content?: string; url?: string }): string {
  const author = opts.author || 'someone';
  const body = (opts.content || '').trim().slice(0, 1200);
  const parts = [
    `Give me more context on this post by @${author} — explain what it's about, any background I should know, and whether it's accurate.`,
  ];
  if (body) parts.push(`\n"${body}"`);
  if (opts.url) parts.push(`\n${opts.url}`);
  return parts.join('\n');
}
