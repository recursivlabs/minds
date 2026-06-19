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

// Get — or lazily generate — the current user's referral link.
export async function getReferralLink(sdk: any): Promise<string | null> {
  if (!sdk) return null;
  try {
    const pickCode = (res: any): string | null => {
      const d = res?.data ?? res;
      const list = d?.codes ?? d ?? [];
      if (Array.isArray(list)) {
        const active = list.find((c: any) => (c?.status ?? 'active') === 'active' && !c?.usedById && !c?.used_by_id);
        return (active?.code || list[0]?.code) ?? null;
      }
      return d?.code ?? null;
    };
    let code = pickCode(await sdk.inviteCodes.myCodes().catch(() => null));
    if (!code) code = pickCode(await sdk.inviteCodes.generate(1).catch(() => null));
    if (!code) return null;
    return `${SITE_URL}/?ref=${encodeURIComponent(code)}`;
  } catch {
    return null;
  }
}
