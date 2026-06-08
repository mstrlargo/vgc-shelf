"use client";

import { useEffect, useState } from "react";
import { api, Collection, User } from "@/lib/api";
import { downloadAuthenticated } from "@/lib/download";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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

export default function BackupsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMode, setCsvMode] = useState<"append" | "replace">("append");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState("");

  const ownedCollections = collections.filter((collection) => collection.role === "OWNER");

  async function load() {
    const [collectionData, meData] = await Promise.all([
      api<{ collections: Collection[] }>("/collections"),
      api<{ user: User }>("/auth/me")
    ]);

    setCollections(collectionData.collections);
    setUser(meData.user);

    const firstOwned = collectionData.collections.find((collection) => collection.role === "OWNER");

    if (firstOwned) {
      setSelectedCollectionId(firstOwned.id);
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
    } catch (err: any) {
      setMessage(err.message || "Collection import failed.");
    }
  }

  async function exportFullDatabase() {
    setMessage("");

    try {
      await downloadAuthenticated(
        "/backup/admin/export.json",
        `vgc-shelf-backup-${new Date().toISOString().slice(0, 10)}.json`
      );
    } catch (err: any) {
      setMessage(err.message || "Full database export failed.");
    }
  }

  async function importFullDatabase(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!jsonFile) {
      setMessage("Choose a JSON backup first.");
      return;
    }

    if (!confirmReplace) {
      setMessage("You must confirm replacement before importing a full database backup.");
      return;
    }

    if (!confirm("This will replace the current database. Continue?")) return;

    try {
      const text = await readTextFile(jsonFile);
      const backup = JSON.parse(text);

      await api("/backup/admin/import.json", {
        method: "POST",
        body: JSON.stringify({
          backup,
          confirmReplace: true
        })
      });

      setMessage("Full database import completed. You may need to sign in again.");
    } catch (err: any) {
      setMessage(err.message || "Full database import failed.");
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <DatabaseBackup className="h-6 w-6 vgc-accent-text" />
            <div>
              <h2 className="text-xl font-bold">Collection CSV Backups</h2>
              <p className="vgc-muted text-sm text-zinc-400">
                Export or import CSV files for collections you own.
              </p>
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

        <Card>
          <div className="mb-5 flex items-center gap-3">
            <DatabaseBackup className="h-6 w-6 vgc-accent-text" />
            <div>
              <h2 className="text-xl font-bold">Full Database Backup</h2>
              <p className="vgc-muted text-sm text-zinc-400">
                Admin-only full export/import for disaster recovery.
              </p>
            </div>
          </div>

          {user?.role === "ADMIN" ? (
            <div className="space-y-4">
              <Button type="button" onClick={exportFullDatabase}>
                Export full database JSON
              </Button>

              <form onSubmit={importFullDatabase} className="rounded-xl border border-red-900 bg-red-950/30 p-4">
                <h3 className="font-semibold text-red-200">Import full database JSON</h3>
                <p className="mt-1 text-sm text-red-100">
                  This replaces the current database. Only import backups you trust.
                </p>

                <div className="mt-4 space-y-3">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                    className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                  />

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmReplace}
                      onChange={(e) => setConfirmReplace(e.target.checked)}
                    />
                    I understand this will replace the current database.
                  </label>

                  <button
                    type="submit"
                    className="rounded-xl border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900"
                  >
                    Import full database
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
              Full database backup tools are admin-only.
            </p>
          )}
        </Card>
      </div>

      {message && <p className="mt-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
    </Shell>
  );
}
