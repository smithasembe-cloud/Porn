import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AUTH_TOKEN_KEY, API_ORIGIN } from '@/lib/api';

WebBrowser.maybeCompleteAuthSession();

export interface MobileUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: MobileUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const discovery = AuthSession.useAutoDiscovery('https://replit.com/oidc');
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'picha-pulse-mobile' });
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_REPL_ID ?? '',
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      redirectUri,
      prompt: AuthSession.Prompt.Login,
    },
    discovery,
  );

  const fetchUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!token || !API_ORIGIN) {
        setUser(null);
        return;
      }
      const result = await fetch(`${API_ORIGIN}/api/auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await result.json();
      if (data.user) {
        setUser(data.user);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier || !API_ORIGIN) {
      return;
    }
    const { code, state } = response.params;
    void (async () => {
      try {
        const exchange = await fetch(`${API_ORIGIN}/api/mobile-auth/token-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            code_verifier: request.codeVerifier,
            redirect_uri: redirectUri,
            state,
          }),
        });
        if (!exchange.ok) throw new Error('Login could not be completed.');
        const data = await exchange.json();
        if (!data.token) throw new Error('Login did not return a session.');
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
        setIsLoading(true);
        await fetchUser();
      } catch {
        setIsLoading(false);
      }
    })();
  }, [response, request, redirectUri, fetchUser]);

  const login = useCallback(async () => {
    if (request) await promptAsync();
  }, [promptAsync, request]);

  const logout = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (token && API_ORIGIN) {
        await fetch(`${API_ORIGIN}/api/mobile-auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}