"use client";

import { useEffect, useState } from "react";
import { api, Collection, User } from "@/lib/api";
import { downloadAuthenticated } from "@/lib/download";
import {
  accentColors,
  AccentColor,
  applyTheme,
  getStoredAccent,
  getStoredTheme,
  saveAccentColor,
  saveTheme,
  ThemeName
} from "@/lib/theme";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { DatabaseBackup, Upload } from "lucide-react";

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "collection";
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMode, setCsvMode] = useState<"append" | "replace">("append");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [accent, setAccent] = useState<AccentColor>("blue");
  const [message, setMessage] = useState("");

  const ownedCollections = collections.filter((collection) => collection.role === "OWNER");

  async function load() {
    const [meData, collectionData] = await Promise.all([
      api<{ user: User }>("/auth/me"),
      api<{ collections: Collection[] }>("/collections")
    ]);

    setUser(meData.user);
    setName(meData.user.name || "");
    setEmail(meData.user.email);
    setCollections(collectionData.collections);

    const firstOwned = collectionData.collections.find((collection) => collection.role === "OWNER");
    if (firstOwned) setSelectedCollectionId(firstOwned.id);

    const storedTheme = getStoredTheme();
    const storedAccent = getStoredAccent();

    setTheme(storedTheme);
    setAccent(storedAccent);
    applyTheme(storedTheme, storedAccent);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      const data = await api<{ user: User }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email
        })
      });

      setUser(data.user);
      setMessage("Profile updated.");
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile.");
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      await api("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (err: any) {
      setMessage(err.message || "Failed to update password.");
    }
  }

  async function exportCollectionCsv() {
    setMessage("");

    const collection = ownedCollections.find((item) => item.id === selectedCollectionId);

    if (!collection) {
      setMessage("Choose one of your owned collections.");
      return;
    }

    try {
      await downloadAuthenticated(
        `/backup/collections/${selectedCollectionId}/export.csv`,
        `${safeFilename(collection.name)}.csv`
      );
    } catch (err: any) {
      setMessage(err.message || "Collection export failed.");
    }
  }

  async function importCollectionCsv(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!selectedCollectionId) {
      setMessage("Choose a collection first.");
      return;
    }

    if (!csvFile) {
      setMessage("Choose a CSV file first.");
      return;
    }

    try {
      const csv = await readTextFile(csvFile);

      const result = await api<{ imported: number; mode: string }>(`/backup/collections/${selectedCollectionId}/import.csv`, {
        method: "POST",
        body: JSON.stringify({
          csv,
          mode: csvMode
        })
      });

      setMessage(`Imported ${result.imported} records using ${result.mode} mode.`);
      setCsvFile(null);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Collection import failed.");
    }
  }

  function chooseTheme(nextTheme: ThemeName) {
    setTheme(nextTheme);
    saveTheme(nextTheme);
  }

  function chooseAccent(nextAccent: AccentColor) {
    setAccent(nextAccent);
    saveAccentColor(nextAccent);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold">User Settings</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">Update your display name and email address.</p>

            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                Current role: <strong>{user?.role}</strong>
              </div>

              <Button type="submit">Save profile</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-bold">Change Password</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">Enter your current password before setting a new one.</p>

            <form onSubmit={updatePassword} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Current password</span>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">New password</span>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </label>

              <Button type="submit">Update password</Button>
            </form>
          </Card>

          <Card>
            <div className="mb-5 flex items-center gap-3">
              <DatabaseBackup className="h-6 w-6 vgc-accent-text" />
              <div>
                <h2 className="text-xl font-bold">Collection CSV Backups</h2>
                <p className="vgc-muted text-sm text-zinc-400">Export or import CSV files for collections you own.</p>
              </div>
            </div>

            {ownedCollections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
                You do not own any collections yet.
              </p>
            ) : (
              <div className="space-y-4">
                <select
                  className="vgc-select"
                  style={{ colorScheme: "light" }}
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                >
                  {ownedCollections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name} · {collection.type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>

                <Button type="button" onClick={exportCollectionCsv}>
                  Export selected collection CSV
                </Button>

                <form onSubmit={importCollectionCsv} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Upload className="h-5 w-5 vgc-accent-text" />
                    <h3 className="font-semibold">Import CSV</h3>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    />

                    <select
                      className="vgc-select"
                      style={{ colorScheme: "light" }}
                      value={csvMode}
                      onChange={(e) => setCsvMode(e.target.value as "append" | "replace")}
                    >
                      <option value="append">Append to collection</option>
                      <option value="replace">Replace collection contents</option>
                    </select>

                    <Button type="submit">Import CSV</Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        </section>

        <Card>
          <h2 className="text-xl font-bold">Appearance</h2>
          <p className="vgc-muted mt-1 text-sm text-zinc-400">Choose your theme and accent color for this browser.</p>

          <div className="mt-6">
            <div className="mb-2 text-sm font-medium">Theme</div>
            <div className="flex gap-2">
              {(["dark", "light"] as ThemeName[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => chooseTheme(option)}
                  className={`rounded-xl border px-4 py-2 text-sm capitalize ${
                    theme === option ? "vgc-accent-border vgc-accent-text" : "border-zinc-700 text-zinc-300"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-sm font-medium">Accent Color</div>
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(accentColors) as AccentColor[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseAccent(key)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm ${
                    accent === key ? "vgc-accent-border" : "border-zinc-700"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `rgb(${accentColors[key].rgb})` }} />
                  <span>{accentColors[key].label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {message && <p className="mt-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
    </Shell>
  );
}
