"use client";

import { useEffect, useState } from "react";
import { api, getToken, login, setToken } from "@/lib/api";
import {
  applyBranding,
  Branding,
  loadBranding,
  resolvedAppIconUrl
} from "@/lib/branding";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Gamepad2 } from "lucide-react";

type PublicAuthSettings = {
  allowPublicSignup: boolean;
  needsFirstAdmin: boolean;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PublicAuthSettings>({
    allowPublicSignup: true,
    needsFirstAdmin: false
  });

  const [branding, setBranding] = useState<Branding>({
    appName: "VGC Shelf",
    pageTitle: "VGC Shelf",
    appIconUrl: "/vgcs-icon.png",
    assetTagPrefix: "VGC",
    labelText: ""
  });

  useEffect(() => {
    if (getToken()) {
      window.location.href = "/collections";
      return;
    }

    loadBranding().then((nextBranding) => {
      setBranding(nextBranding);
      applyBranding(nextBranding);
    });

    api<{ settings: PublicAuthSettings }>("/auth/settings")
      .then((data) => setSettings(data.settings))
      .catch(() => {
        setSettings({
          allowPublicSignup: true,
          needsFirstAdmin: false
        });
      });
  }, []);

  const appIconUrl = resolvedAppIconUrl(branding);
  const canRegister = settings.allowPublicSignup || settings.needsFirstAdmin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const data = await login(email, password);
      setToken(data.token);
      window.location.href = "/collections";
    } catch (err: any) {
      setMessage(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          {appIconUrl ? (
            <img
              src={appIconUrl}
              alt=""
              className="h-11 w-11 rounded-md object-contain"
            />
          ) : (
            <Gamepad2 className="h-10 w-10 vgc-accent-text" />
          )}

          <div>
            <h1 className="text-4xl font-bold">
              {branding.appName}
            </h1>

            <p className="text-zinc-400">
              Video game collection tracker
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur">
          <h2 className="mb-6 text-3xl font-bold">
            Sign In
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />

            <Input
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full justify-center"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 text-sm">
            {canRegister ? (
              <a
                href="/register"
                className="vgc-accent-text hover:underline"
              >
                {settings.needsFirstAdmin ? "Create the first admin account" : "Need an account? Register"}
              </a>
            ) : (
              <p className="text-zinc-500">
                Public signup is disabled. Ask an administrator to create your account.
              </p>
            )}
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-800/70 px-4 py-3 text-sm text-zinc-200">
              {message}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
