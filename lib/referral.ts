// Referral v1 — "Refer friends + earn".
// A user shares their invite link (?ref=<code>); when a friend signs up with it,
// we redeem the code so the referrer is credited (server sets the code's
// usedById = the new user; createdById = the referrer). Earning payouts on top
// of this attribution come in v2.
import { getItem, setItem } from './storage';
import { SITE_URL } from './recursiv';

const REF_KEY = 'minds:pendingRef';

// Capture ?ref=<code> from the landing URL (web) so we can attribute the signup.
export function captureRefFromUrl(): void {
  if (typeof window === 'undefined' || !window.location?.search) return;
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9_-]{1,40}$/.test(ref)) setItem(REF_KEY, ref);
  } catch {}
}

export async function getPendingRef(): Promise<string | null> {
  try { return (await getItem(REF_KEY)) || null; } catch { return null; }
}

export function clearPendingRef(): void {
  try { setItem(REF_KEY, ''); } catch {}
}

// Normalize the various code shapes the SDK returns into a usable code string.
//   myCodes()  -> { data: { codes: InviteCode[] } }  (objects: {code, status, used_by, ...})
//   generate() -> { data: { codes: string[] } }      (plain code strings)
// Returns the best *shareable* code: an active, not-yet-redeemed one if present,
// otherwise the first code of any kind (still a valid link for new signups).
function pickCode(res: any): string | null {
  const d = res?.data ?? res;
  const list = d?.codes ?? (Array.isArray(d) ? d : null);
  if (Array.isArray(list) && list.length) {
    // generate() shape: array of plain strings.
    if (typeof list[0] === 'string') {
      const firstString = list.find((c: any) => typeof c === 'string' && c.length > 0);
      return firstString ?? null;
    }
    // myCodes() shape: array of InviteCode objects. Prefer an active, unused code.
    const active = list.find(
      (c: any) => (c?.status ?? 'active') === 'active' && !c?.used_by,
    );
    return (active?.code || list[0]?.code) ?? null;
  }
  // Fallbacks for any single-object shape.
  return d?.code ?? null;
}

// Get — or lazily generate — the current user's referral link.
export async function getReferralLink(sdk: any): Promise<string | null> {
  if (!sdk) return null;
  try {
    // 1. Reuse an existing code if the user already has one.
    let code = pickCode(await sdk.inviteCodes.myCodes().catch(() => null));
    // 2. Otherwise mint one. generate() returns a string[] under data.codes.
    if (!code) code = pickCode(await sdk.inviteCodes.generate(1).catch(() => null));
    if (!code) return null;
    return `${SITE_URL}/?ref=${encodeURIComponent(code)}`;
  } catch {
    return null;
  }
}
