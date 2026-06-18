/**
 * Resolve the signed-in user's single personal agent (e.g. Santiago).
 *
 * Why this exists: agents are listed owner-scoped + newest-first, and a heavy
 * Recursiv user can own hundreds of agents across projects. The personal agent
 * is often OLDER than a full page of them, so the old pattern —
 * `agents.list({ limit: 50 }).find(a => a.agent_type === 'personal')` —
 * silently returned nothing and every caller dead-ended to the *create agent*
 * screen even though a personal agent existed. (This was the "Santiago routes
 * to setup" bug.)
 *
 * The fix is an exact, pagination-proof lookup via the server-side
 * `agent_type=personal` filter, with a wider-scan fallback for any API that
 * predates the filter. Returns the agent object, or null if none exists.
 */
export async function resolvePersonalAgent(sdk: any): Promise<any | null> {
  if (!sdk?.agents?.list) return null;

  // Preferred: exact server-side filter. One row, no pagination dependence.
  try {
    const res = await sdk.agents.list({ agent_type: 'personal', limit: 1 });
    const personal = (res?.data || [])[0];
    if (personal) return personal;
  } catch {
    // Older API without the filter — fall through to the wider scan.
  }

  // Fallback: scan a large page and match client-side. Covers the pre-filter
  // deploy window; the filtered path above is the durable fix.
  try {
    const res = await sdk.agents.list({ limit: 100 });
    return (
      (res?.data || []).find(
        (a: any) => a.agent_type === 'personal' || a.agentType === 'personal'
      ) ?? null
    );
  } catch {
    return null;
  }
}
