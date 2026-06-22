import * as React from 'react';
import { router } from 'expo-router';
import { Recursiv } from '@recursiv/sdk';
import { BASE_URL, BASE_ORIGIN, PROJECT_ID, createAuthedSdk } from './recursiv';
import * as storage from './storage';
import { captureRefFromUrl, getPendingRef, clearPendingRef } from './referral';
import { registerPushToken, registerTokenWithServer } from './notifications';
import { captureException } from './monitoring';
import { clearAll as clearCacheAll, setCacheUser } from './cache';
import { setSignalsSdk } from './signals';

function registerPushTokenBackground(sdk: Recursiv) {
  registerPushToken().then(token => {
    if (token) registerTokenWithServer(sdk, token);
  }).catch(() => {});
}

const KEYS = {
  apiKey: 'minds:api_key',
  user: 'minds:user',
  projectId: 'minds:project_id',
  version: 'minds:auth_version',
};

// Bump when scopes change OR when the auth model changes to force re-auth.
// 5: added uploads:read/write scope (legacy, pre-Project Membership)
// 6: Project Membership rollout — api keys are now project-scoped (not
//    org-scoped). Customers become project_members of the Minds app, not
//    organization_members of the owning Minds org. Bumping forces existing
//    customers to re-auth so their stored key gets reissued with the new binding.
// 7: added wallet:read/wallet:write so the in-app wallet stops 403-ing
//    ("Couldn't load your wallet"). Existing keys lack the scope; re-auth reissues.
const AUTH_VERSION = '8';

const API_KEY_SCOPES = [
  'posts:read', 'posts:write',
  'users:read', 'users:write',
  'communities:read', 'communities:write',
  'chat:read', 'chat:write',
  'agents:read', 'agents:write',
  'organizations:read', 'organizations:write',
  'memory:read', 'memory:write',
  'tags:read', 'tags:write',
  'databases:read', 'databases:write',
  'storage:read', 'storage:write',
  'settings:read', 'settings:write',
  'billing:read', 'billing:write',
  'notifications:read', 'notifications:write',
  'wallet:read', 'wallet:write',
  'uploads:write',
  // Admin dashboard. The scope is necessary-but-not-sufficient: every admin
  // route also enforces a LIVE admin role (requireLiveAdminRole), so a
  // non-admin's key carrying this scope still cannot use admin endpoints.
  // TODO(server hardening): only grant 'admin' at key-mint for admin/owner
  // roles so non-admin keys don't carry an unusable scope.
  'admin',
] as const;

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
  bio: string;
  // Network-level role from /users/me. Gates the admin nav + badge. Optional
  // because older cached user JSON (pre-this-field) won't have it.
  role?: 'user' | 'admin';
}

interface AuthContextValue {
  user: User | null;
  sdk: Recursiv | null;
  projectId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

// Anonymous SDK for auth operations (signUp/signIn don't need an API key)
const anonSdk = new Recursiv({ apiKey: 'anonymous', baseUrl: BASE_URL, timeout: 30_000 } as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authedSdk, setAuthedSdk] = React.useState<Recursiv | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Capture a referral code (?ref=) from the landing URL before anything else,
  // so a friend who arrives via an invite link gets attributed on signup.
  React.useEffect(() => { captureRefFromUrl(); }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const storedVersion = await storage.getItem(KEYS.version);
        if (storedVersion !== AUTH_VERSION) {
          await clearStorage();
          setIsLoading(false);
          return;
        }

        const [storedApiKey, storedUser, storedProjectId] = await Promise.all([
          storage.getItem(KEYS.apiKey),
          storage.getItem(KEYS.user),
          storage.getItem(KEYS.projectId),
        ]);

        if (storedApiKey && storedUser) {
          const sdk = createAuthedSdk(storedApiKey);
          const bootUser = JSON.parse(storedUser);
          // Restore the session optimistically — the stored user is what gets
          // rendered anyway, and blocking first paint on a users.me() round
          // trip (with the SDK's 120s timeout) meant a slow API at cutover
          // holds the entire migrated user base on the splash screen at once.
          // Point the cache at THIS user's namespace before anything renders,
          // so a previous account's cached data can't flash through.
          setCacheUser(bootUser?.id ?? null);
          setAuthedSdk(sdk);
          setSignalsSdk(sdk);
          setUser(bootUser);
          setProjectId(storedProjectId);
          registerPushTokenBackground(sdk);
          // Validate in the background; only a definitive auth rejection
          // (401/403) tears the session down — not billing (402) or 5xx.
          void (async () => {
            try {
              const meRes = await sdk.users.me();
              const me = (meRes as any).data || meRes;
              // The API KEY decides who the server treats us as — the stored
              // user JSON is just a display copy, and the two CAN drift (e.g.
              // multi-account storage races). If they disagree, adopt the
              // server's identity everywhere: stored JSON, rendered user, and
              // the cache namespace. Without this, the chip says one account
              // while every fetch acts as another — the "identity changed /
              // groups I never joined / my own profile 404s" bug.
              if (me?.id) {
                if (me.id !== bootUser?.id) {
                  captureException(new Error('auth identity mismatch: stored user differs from key owner'), {
                    phase: 'auth_boot_validate', storedId: bootUser?.id, keyOwnerId: me.id,
                  });
                }
                // Always adopt the server's canonical user — not only on an
                // identity MISMATCH. The cached bootUser is a stale display copy
                // and can be missing fields the server now returns (notably
                // `role`, which gates the admin UI). Without syncing on the
                // normal same-account path, a role change never reaches the
                // client and the admin nav stays hidden forever.
                const canonical: User = {
                  id: me.id,
                  name: me.name || bootUser?.name || '',
                  email: me.email || bootUser?.email || '',
                  username: me.username || bootUser?.username || '',
                  image: me.image ?? bootUser?.image ?? null,
                  bio: me.bio || me.briefdescription || bootUser?.bio || '',
                  role: me.role ?? (me.is_admin ? 'admin' : undefined),
                };
                if (JSON.stringify(canonical) !== JSON.stringify(bootUser)) {
                  await storage.setItem(KEYS.user, JSON.stringify(canonical));
                  setCacheUser(me.id);
                  setUser(canonical);
                }
              }
            } catch (err: any) {
              const status = err?.statusCode || err?.status || 0;
              if (status === 401 || status === 403) {
                await clearStorage();
                setCacheUser(null);
                setAuthedSdk(null);
                setSignalsSdk(null);
                setUser(null);
                setProjectId(null);
              }
            }
          })();
        }
      } catch (err) {
        // An unexpected error during boot logs the user out — make it visible
        // so we can tell a real failure from an expected token expiry.
        captureException(err, { phase: 'auth_boot' });
        await clearStorage();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function clearStorage() {
    await Promise.all([
      storage.removeItem(KEYS.apiKey),
      storage.removeItem(KEYS.user),
      storage.removeItem(KEYS.projectId),
      storage.removeItem(KEYS.version),
    ]).catch(() => {});
  }

  async function persistSession(apiKey: string, authUser: User) {
    // Point the cache at this user's namespace. Switching accounts in the same
    // browser loads the new user's own (or empty) cache — the previous user's
    // audience-scoped data (profile, conversations, communities) can never bleed
    // in, since each account reads/writes only its own namespaced key.
    setCacheUser(authUser.id);
    const sdk = createAuthedSdk(apiKey);
    await Promise.all([
      storage.setItem(KEYS.apiKey, apiKey),
      storage.setItem(KEYS.user, JSON.stringify(authUser)),
      storage.setItem(KEYS.projectId, PROJECT_ID),
      storage.setItem(KEYS.version, AUTH_VERSION),
    ]);
    setAuthedSdk(sdk);
    setSignalsSdk(sdk);
    setUser(authUser);
    setProjectId(PROJECT_ID);
    registerPushTokenBackground(sdk);

    // Re-fetch the user record from the server. Sign-up/sign-in responses
    // can return an incomplete user (e.g. server hasn't assigned the
    // slugified username yet; client falls back to email-prefix which
    // contains `+` or other URL-unsafe chars). Fetching `users.me()`
    // overwrites with the canonical username so profile navigation works.
    try {
      const res = await sdk.users.me();
      const me = (res as any).data || res;
      if (me) {
        const canonical: User = {
          id: me.id || authUser.id,
          name: me.name || authUser.name,
          email: me.email || authUser.email,
          username: me.username || authUser.username,
          image: me.image ?? authUser.image,
          bio: me.bio || me.briefdescription || authUser.bio,
        };
        setUser(canonical);
        await storage.setItem(KEYS.user, JSON.stringify(canonical));
      }
    } catch {
      // Non-fatal — the half-baked user still works for most flows;
      // refreshUser() will rehydrate on next manual trigger.
    }
  }

  const refreshUser = React.useCallback(async () => {
    if (!authedSdk) return;
    try {
      const res = await authedSdk.users.me();
      const me = (res as any).data || res;
      if (me) {
        // Cache-bust the avatar so React Native / the browser treat a new
        // upload as a new resource. Server typically returns a stable URL
        // per user (e.g. /avatars/<id>), so without the query param the
        // <Image> layer reuses the cached blob and the old avatar keeps
        // showing until a hard reload.
        const rawImage = me.image ?? user?.image ?? null;
        const cachedBusted = rawImage
          ? `${rawImage}${rawImage.includes('?') ? '&' : '?'}v=${Date.now()}`
          : null;
        const updated: User = {
          id: me.id || user?.id || '',
          name: me.name || user?.name || '',
          email: me.email || user?.email || '',
          username: me.username || user?.username || '',
          image: cachedBusted,
          bio: me.bio || me.briefdescription || user?.bio || '',
        };
        setUser(updated);
        await storage.setItem(KEYS.user, JSON.stringify(updated));
      }
    } catch {}
  }, [authedSdk, user]);

  const sendOtp = React.useCallback(async (email: string) => {
    await anonSdk.auth.sendOtp({ email });
  }, []);

  const verifyOtp = React.useCallback(async (email: string, otp: string) => {
    const result = await anonSdk.auth.verifyOtpAndCreateKey(
      { email, otp },
      // rateLimitPerMinute: lift the session key off the 60/min default — a
      // realtime app (feed + notifications + chat polling + ws-token reconnects)
      // blows 60/min and falls into a 429 dead state. 1000 is the per-key max;
      // the per-user tier cap (currently 100/min) is the next ceiling — raising
      // that is a platform-side follow-up.
      { name: `minds-${Date.now()}`, scopes: [...API_KEY_SCOPES], projectId: PROJECT_ID, rateLimitPerMinute: 1000 } as any,
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || '',
      email: result.user?.email || email,
      username: (result.user as any)?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
    });
  }, []);

  const signUp = React.useCallback(async (name: string, email: string, password: string) => {
    const result = await anonSdk.auth.signUpAndCreateKey(
      { name, email, password },
      // rateLimitPerMinute: lift the session key off the 60/min default — a
      // realtime app (feed + notifications + chat polling + ws-token reconnects)
      // blows 60/min and falls into a 429 dead state. 1000 is the per-key max;
      // the per-user tier cap (currently 100/min) is the next ceiling — raising
      // that is a platform-side follow-up.
      { name: `minds-${Date.now()}`, scopes: [...API_KEY_SCOPES], projectId: PROJECT_ID, rateLimitPerMinute: 1000 } as any,
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || name,
      email: result.user?.email || email,
      username: (result.user as any)?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
    });

    // Credit the referrer: if this person arrived via an invite link (?ref=),
    // redeem that code now that they have an account, attributing the signup.
    try {
      const ref = await getPendingRef();
      if (ref) {
        await createAuthedSdk(result.apiKey).inviteCodes.redeem(ref).catch(() => {});
        clearPendingRef();
      }
    } catch {}
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const result = await anonSdk.auth.signInAndCreateKey(
      { email, password },
      // rateLimitPerMinute: lift the session key off the 60/min default — a
      // realtime app (feed + notifications + chat polling + ws-token reconnects)
      // blows 60/min and falls into a 429 dead state. 1000 is the per-key max;
      // the per-user tier cap (currently 100/min) is the next ceiling — raising
      // that is a platform-side follow-up.
      { name: `minds-${Date.now()}`, scopes: [...API_KEY_SCOPES], projectId: PROJECT_ID, rateLimitPerMinute: 1000 } as any,
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || '',
      email: result.user?.email || email,
      username: (result.user as any)?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
    });
  }, []);

  const signOut = React.useCallback(async () => {
    await clearStorage();
    // Drop all cached data so the next user in this browser doesn't
    // inherit the previous user's personal feed / conversations /
    // messages / profile. Without this jack signs out, jacktest1
    // signs in, and sees jack's audience-scoped Discover posts +
    // 404s when clicking them.
    clearCacheAll();
    setCacheUser(null); // reset to the anon namespace
    setUser(null);
    setAuthedSdk(null);
    setSignalsSdk(null);
    setProjectId(null);
    // Storage + auth state are cleared above. On web a SOFT nav left the authed
    // tab shell half-mounted (you'd be stuck "half logged out" until a manual
    // refresh), so force a hard reload to '/' — it boots fresh with no session
    // and lands straight on the logged-out auth screen. Native re-renders fine
    // off the state reset via router.replace.
    if (typeof window !== 'undefined' && window.location) {
      window.location.replace('/');
    } else {
      router.replace('/');
    }
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      sdk: authedSdk,
      projectId,
      isLoading,
      isAuthenticated: !!user,
      refreshUser,
      sendOtp,
      verifyOtp,
      signUp,
      signIn,
      signOut,
    }),
    [user, authedSdk, projectId, isLoading, refreshUser, sendOtp, verifyOtp, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
