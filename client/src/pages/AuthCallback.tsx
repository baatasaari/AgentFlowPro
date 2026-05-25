import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const { login } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const isNew = params.get("new") === "true";

    if (!token) { navigate("/login?error=no_token"); return; }

    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        login(token, data.user, data.organization);
        navigate("/dashboard");
      })
      .catch(() => navigate("/login?error=invalid_token"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
