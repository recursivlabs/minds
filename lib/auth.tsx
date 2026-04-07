import * as React from 'react';
import { Recursiv } from '@recursiv/sdk';
import { BASE_URL, BASE_ORIGIN, ORG_ID, createAuthedSdk } from './recursiv';
import * as storage from './storage';

const KEYS = {
  apiKey: 'minds:api_key',
  user: 'minds:user',
  orgId: 'minds:org_id',
  version: 'minds:auth_version',
};

const AUTH_VERSION = '4';

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
] as const;

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

// Anonymous SDK for auth operations (signUp/signIn don't need an API key)
const anonSdk = new Recursiv({ apiKey: 'anonymous', baseUrl: BASE_URL, timeout: 30_000 } as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authedSdk, setAuthedSdk] = React.useState<Recursiv | null>(null);
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

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

  async function persistSession(apiKey: string, authUser: User) {
    const sdk = createAuthedSdk(apiKey);
    await Promise.all([
      storage.setItem(KEYS.apiKey, apiKey),
      storage.setItem(KEYS.user, JSON.stringify(authUser)),
      storage.setItem(KEYS.orgId, ORG_ID),
      storage.setItem(KEYS.version, AUTH_VERSION),
    ]);
    setAuthedSdk(sdk);
    setUser(authUser);
    setOrgId(ORG_ID);
  }

  const signUp = React.useCallback(async (name: string, email: string, password: string) => {
    const result = await anonSdk.auth.signUpAndCreateKey(
      { name, email, password },
      { name: 'minds-' + Date.now(), scopes: [...API_KEY_SCOPES], organizationId: ORG_ID },
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || name,
      email: result.user?.email || email,
      username: result.user?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
    });
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const result = await anonSdk.auth.signInAndCreateKey(
      { email, password },
      { name: 'minds-' + Date.now(), scopes: [...API_KEY_SCOPES], organizationId: ORG_ID },
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || '',
      email: result.user?.email || email,
      username: result.user?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
    });
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
