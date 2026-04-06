import * as React from 'react';
import { Recursiv } from '@recursiv/sdk';
import { BASE_ORIGIN, ORG_ID, createAuthedSdk } from './recursiv';
import * as storage from './storage';

const KEYS = {
  apiKey: 'minds:api_key',
  user: 'minds:user',
  orgId: 'minds:org_id',
  version: 'minds:auth_version',
};

// Bump this when scopes change to force re-auth
const AUTH_VERSION = '3';

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
  bio: string;
}

interface AuthContextValue {
  user: User | null;
  sdk: Recursiv | null;
  orgId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/**
 * Create a per-user API key scoped to the Minds org.
 * Uses session token from sign-up/sign-in (not cookies — cookies don't persist on mobile).
 */
async function createApiKeyWithSession(sessionToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_ORIGIN}/api/v1/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        name: 'minds-' + Date.now(),
        organizationId: ORG_ID,
        scopes: [
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
          'settings:read',
          'notifications:read', 'notifications:write',
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Auth] createApiKey failed:', res.status, errText.slice(0, 500));
      return null;
    }
    const data = await res.json();
    return data.data?.key || data.key || null;
  } catch (err) {
    console.error('[Auth] createApiKey error:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authedSdk, setAuthedSdk] = React.useState<Recursiv | null>(null);
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Restore session on mount
  React.useEffect(() => {
    (async () => {
      try {
        const storedVersion = await storage.getItem(KEYS.version);
        if (storedVersion !== AUTH_VERSION) {
          await clearStorage();
          setIsLoading(false);
          return;
        }

        const [storedApiKey, storedUser, storedOrgId] = await Promise.all([
          storage.getItem(KEYS.apiKey),
          storage.getItem(KEYS.user),
          storage.getItem(KEYS.orgId),
        ]);

        if (storedApiKey && storedUser) {
          const sdk = createAuthedSdk(storedApiKey);
          try {
            await sdk.users.me();
            setAuthedSdk(sdk);
            setUser(JSON.parse(storedUser));
            setOrgId(storedOrgId);
          } catch {
            await clearStorage();
          }
        }
      } catch {
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
      storage.removeItem(KEYS.orgId),
      storage.removeItem(KEYS.version),
    ]).catch(() => {});
  }

  const signUp = React.useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch(`${BASE_ORIGIN}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_ORIGIN },
      body: JSON.stringify({ name, email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {}
      throw new Error(parsed.message || `Sign up failed (${res.status})`);
    }

    const body = await res.json();

    // Extract session token (cookies don't persist on mobile/cross-origin)
    const sessionToken = body?.session?.token || body?.token;
    if (!sessionToken) throw new Error('No session token returned');

    const apiKey = await createApiKeyWithSession(sessionToken);
    if (!apiKey) throw new Error('Failed to create session key');

    const sdk = createAuthedSdk(apiKey);
    const authUser: User = {
      id: body.user?.id || body.id,
      name: body.user?.name || name,
      email: body.user?.email || email,
      username: body.user?.username || email.split('@')[0],
      image: body.user?.image ?? null,
      bio: body.user?.bio || '',
    };

    await Promise.all([
      storage.setItem(KEYS.apiKey, apiKey),
      storage.setItem(KEYS.user, JSON.stringify(authUser)),
      storage.setItem(KEYS.orgId, ORG_ID),
      storage.setItem(KEYS.version, AUTH_VERSION),
    ]);

    setAuthedSdk(sdk);
    setUser(authUser);
    setOrgId(ORG_ID);
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE_ORIGIN}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': BASE_ORIGIN },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed: any = {};
      try { parsed = JSON.parse(text); } catch {}
      throw new Error(parsed.message || `Sign in failed (${res.status})`);
    }

    const body = await res.json();

    // Extract session token
    const sessionToken = body?.session?.token || body?.token;
    if (!sessionToken) throw new Error('No session token returned');

    const apiKey = await createApiKeyWithSession(sessionToken);
    if (!apiKey) throw new Error('Failed to create session key');

    const sdk = createAuthedSdk(apiKey);
    const authUser: User = {
      id: body.user?.id || body.id,
      name: body.user?.name || '',
      email: body.user?.email || email,
      username: body.user?.username || email.split('@')[0],
      image: body.user?.image ?? null,
      bio: body.user?.bio || '',
    };

    await Promise.all([
      storage.setItem(KEYS.apiKey, apiKey),
      storage.setItem(KEYS.user, JSON.stringify(authUser)),
      storage.setItem(KEYS.orgId, ORG_ID),
      storage.setItem(KEYS.version, AUTH_VERSION),
    ]);

    setAuthedSdk(sdk);
    setUser(authUser);
    setOrgId(ORG_ID);
  }, []);

  const signOut = React.useCallback(async () => {
    await clearStorage();
    setUser(null);
    setAuthedSdk(null);
    setOrgId(null);
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      sdk: authedSdk,
      orgId,
      isLoading,
      isAuthenticated: !!user,
      signUp,
      signIn,
      signOut,
    }),
    [user, authedSdk, orgId, isLoading, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
