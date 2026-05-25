import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

interface AuthOrg {
  id: number;
  name: string;
  slug: string;
  plan: string;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  isSuspended: boolean | null;
  stripeSubscriptionId: string | null;
  maxAgents: number;
  maxMonthlyMessages: number;
  messagesThisPeriod: number;
}

interface AuthState {
  user: AuthUser | null;
  organization: AuthOrg | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login(token: string, user: AuthUser, org: AuthOrg | null): void;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "afp_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    organization: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState(s => ({ ...s, isLoading: false }));
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setState({ user: data.user, organization: data.organization, token, isLoading: false, isAuthenticated: true });
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setState(s => ({ ...s, token: null, isLoading: false }));
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState(s => ({ ...s, token: null, isLoading: false }));
      });
  }, []);

  function login(token: string, user: AuthUser, org: AuthOrg | null) {
    localStorage.setItem(TOKEN_KEY, token);
    setState({ user, organization: org, token, isLoading: false, isAuthenticated: true });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, organization: null, token: null, isLoading: false, isAuthenticated: false });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
