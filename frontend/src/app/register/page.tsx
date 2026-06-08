"use client";

import { useEffect, useState } from "react";
import { api, getToken, register, setToken } from "@/lib/api";
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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (!canRegister) {
      setMessage("Public signup is disabled. Ask an administrator to create your account.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const data = await register(email, password, name.trim() || undefined);
      setToken(data.token);
      window.location.href = "/collections";
    } catch (err: any) {
      setMessage(err.message || "Registration failed.");
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
          <h2 className="mb-2 text-3xl font-bold">
            {settings.needsFirstAdmin ? "Create Admin Account" : "Create Account"}
          </h2>

          <p className="mb-6 text-sm text-zinc-400">
            {settings.needsFirstAdmin
              ? "This first account will be created as an administrator."
              : "Create a new VGC Shelf user account."}
          </p>

          {canRegister ? (
            <form onSubmit={submit} className="space-y-4">
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

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
                minLength={8}
              />

              <Input
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                required
                minLength={8}
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full justify-center"
              >
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/70 px-4 py-3 text-sm text-zinc-200">
              Public signup is disabled. Ask an administrator to create your account.
            </div>
          )}

          <div className="mt-5 text-sm">
            <a href="/" className="vgc-accent-text hover:underline">
              Already have an account? Sign in
            </a>
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
