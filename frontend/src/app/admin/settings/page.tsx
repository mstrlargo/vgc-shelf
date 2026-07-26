"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { applyBranding } from "@/lib/branding";
import { downloadAuthenticated } from "@/lib/download";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { DatabaseBackup, Trash2 } from "lucide-react";

type ApiKeys = {
  igdbClientId: string | null;
  igdbClientSecret: string | null;
  priceChartingApiKey: string | null;
  rawgApiKey: string | null;
  giantBombApiKey: string | null;
  mobyGamesApiKey: string | null;
  steamWebApiKey: string | null;
  customMetadataApiUrl: string | null;
  customMetadataApiKey: string | null;
};

type AdminBranding = {
  appName: string;
  pageTitle: string;
  appIconUrl?: string | null;
  assetTagPrefix?: string;
  labelText?: string | null;
  assetLabelWidth?: number;
  assetLabelHeight?: number;
  assetLabelShowQr?: boolean;
  assetLabelShowLabelText?: boolean;
  assetLabelShowAssetTag?: boolean;
  assetLabelShowItemTitle?: boolean;
  assetLabelShowCollectionName?: boolean;
  assetLabelShowPlatform?: boolean;
  assetLabelShowCollectionType?: boolean;
  assetLabelShowOwnerName?: boolean;
  assetLabelShowOwnerEmail?: boolean;
  assetLabelShowBarcode?: boolean;
};

type AssetLabelBooleanKey =
  | "assetLabelShowQr"
  | "assetLabelShowLabelText"
  | "assetLabelShowAssetTag"
  | "assetLabelShowItemTitle"
  | "assetLabelShowCollectionName"
  | "assetLabelShowPlatform"
  | "assetLabelShowCollectionType"
  | "assetLabelShowOwnerName"
  | "assetLabelShowOwnerEmail"
  | "assetLabelShowBarcode";

type SmtpSettings = {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string | null;
  configured: boolean;
};

type LendingReminderSettings = {
  enabled: boolean;
  timing: "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE";
  days: number;
  repeatDays: number;
  subject: string;
  message: string;
};

type Settings = {
  allowPublicSignup: boolean;
  branding: AdminBranding;
  apiKeys: ApiKeys;
  smtp: SmtpSettings;
  lendingReminders: LendingReminderSettings;
};

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN" | "USER";
  createdAt?: string;
};

const apiKeyFields: Array<{ key: keyof ApiKeys; label: string; placeholder?: string; type?: string }> = [
  { key: "igdbClientId", label: "IGDB Client ID" },
  { key: "igdbClientSecret", label: "IGDB Client Secret" },
  { key: "priceChartingApiKey", label: "PriceCharting API Key" },
  { key: "rawgApiKey", label: "RAWG API Key" },
  { key: "giantBombApiKey", label: "GiantBomb API Key" },
  { key: "mobyGamesApiKey", label: "MobyGames API Key" },
  { key: "steamWebApiKey", label: "Steam Web API Key" },
  { key: "customMetadataApiUrl", label: "Custom Metadata API URL", placeholder: "https://example.com/api", type: "url" },
  { key: "customMetadataApiKey", label: "Custom Metadata API Key" }
];

const assetLabelFields: Array<{ key: AssetLabelBooleanKey; label: string }> = [
  { key: "assetLabelShowQr", label: "QR code" },
  { key: "assetLabelShowLabelText", label: "Asset label text" },
  { key: "assetLabelShowAssetTag", label: "Asset tag" },
  { key: "assetLabelShowItemTitle", label: "Item title" },
  { key: "assetLabelShowCollectionName", label: "Collection name" },
  { key: "assetLabelShowPlatform", label: "Platform" },
  { key: "assetLabelShowCollectionType", label: "Collection type" },
  { key: "assetLabelShowOwnerName", label: "Owner name" },
  { key: "assetLabelShowOwnerEmail", label: "Owner email" },
  { key: "assetLabelShowBarcode", label: "Barcode" }
];

function assetLabelOptions(branding: Partial<AdminBranding>) {
  return {
    assetLabelShowQr: branding.assetLabelShowQr ?? true,
    assetLabelShowLabelText: branding.assetLabelShowLabelText ?? true,
    assetLabelShowAssetTag: branding.assetLabelShowAssetTag ?? true,
    assetLabelShowItemTitle: branding.assetLabelShowItemTitle ?? false,
    assetLabelShowCollectionName: branding.assetLabelShowCollectionName ?? false,
    assetLabelShowPlatform: branding.assetLabelShowPlatform ?? false,
    assetLabelShowCollectionType: branding.assetLabelShowCollectionType ?? false,
    assetLabelShowOwnerName: branding.assetLabelShowOwnerName ?? true,
    assetLabelShowOwnerEmail: branding.assetLabelShowOwnerEmail ?? true,
    assetLabelShowBarcode: branding.assetLabelShowBarcode ?? false
  };
}

function blankApiKeys(): Record<keyof ApiKeys, string> {
  return {
    igdbClientId: "",
    igdbClientSecret: "",
    priceChartingApiKey: "",
    rawgApiKey: "",
    giantBombApiKey: "",
    mobyGamesApiKey: "",
    steamWebApiKey: "",
    customMetadataApiUrl: "",
    customMetadataApiKey: ""
  };
}

function normalizePrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apiKeyDraft, setApiKeyDraft] = useState<Record<keyof ApiKeys, string>>(blankApiKeys());
  const [brandingDraft, setBrandingDraft] = useState<AdminBranding>({
    appName: "VGC Shelf",
    pageTitle: "VGC Shelf",
    appIconUrl: "",
    assetTagPrefix: "VGC",
    labelText: "",
    assetLabelWidth: 2.25,
    assetLabelHeight: 1.0,
    ...assetLabelOptions({})
  });
  const [smtpDraft, setSmtpDraft] = useState({
    host: "",
    port: "587",
    secure: false,
    user: "",
    password: "",
    from: ""
  });
  const [reminderDraft, setReminderDraft] = useState({
    enabled: true,
    timing: "AFTER_DUE" as "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE",
    days: "0",
    repeatDays: "1",
    subject: "Reminder: {{title}} is due {{dueDate}}",
    message: "Hello {{borrowerName}},\n\nThis is a reminder that {{title}} ({{assetTag}}) from {{collectionName}} is due {{dueDate}}.\n\nPlease arrange to return it.\n\nThank you."
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("Password123!");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSettings() {
    const settingsData = await api<{ settings: Settings }>("/admin/settings");

    setSettings(settingsData.settings);
    setApiKeyDraft(blankApiKeys());

    setBrandingDraft({
      appName: settingsData.settings.branding.appName || "VGC Shelf",
      pageTitle: settingsData.settings.branding.pageTitle || "VGC Shelf",
      appIconUrl: settingsData.settings.branding.appIconUrl || "",
      assetTagPrefix: settingsData.settings.branding.assetTagPrefix || "VGC",
      labelText: settingsData.settings.branding.labelText || "",
      assetLabelWidth: Number(settingsData.settings.branding.assetLabelWidth) || 2.25,
      assetLabelHeight: Number(settingsData.settings.branding.assetLabelHeight) || 1.0,
      ...assetLabelOptions(settingsData.settings.branding)
    });
    setSmtpDraft({
      host: settingsData.settings.smtp?.host || "",
      port: String(settingsData.settings.smtp?.port || 587),
      secure: Boolean(settingsData.settings.smtp?.secure),
      user: settingsData.settings.smtp?.user || "",
      password: "",
      from: settingsData.settings.smtp?.from || ""
    });
    setReminderDraft({
      enabled: settingsData.settings.lendingReminders?.enabled ?? true,
      timing: settingsData.settings.lendingReminders?.timing || "AFTER_DUE",
      days: String(settingsData.settings.lendingReminders?.days ?? 0),
      repeatDays: String(settingsData.settings.lendingReminders?.repeatDays ?? 1),
      subject: settingsData.settings.lendingReminders?.subject || "Reminder: {{title}} is due {{dueDate}}",
      message: settingsData.settings.lendingReminders?.message || "Hello {{borrowerName}},\n\nThis is a reminder that {{title}} ({{assetTag}}) from {{collectionName}} is due {{dueDate}}.\n\nPlease arrange to return it.\n\nThank you."
    });
  }

  async function loadUsers() {
    const usersData = await api<{ users: AdminUser[] }>("/admin/users");
    setUsers(usersData.users);
  }

  async function load() {
    setMessage("");

    const results = await Promise.allSettled([loadSettings(), loadUsers()]);
    const errors = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[];

    if (errors.length > 0) {
      setMessage(errors.map((error) => error.reason?.message || "Failed to load admin data.").join(" "));
    }
  }

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const assetTagPrefix = normalizePrefix(brandingDraft.assetTagPrefix || "VGC");

    if (assetTagPrefix.length !== 3) {
      setMessage("Asset tag prefix must be exactly 3 letters or numbers.");
      return;
    }

    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          branding: {
            appName: brandingDraft.appName,
            pageTitle: brandingDraft.pageTitle,
            appIconUrl: brandingDraft.appIconUrl || null,
            assetTagPrefix,
            labelText: brandingDraft.labelText || null,
            assetLabelWidth: Number(brandingDraft.assetLabelWidth) || 2.25,
            assetLabelHeight: Number(brandingDraft.assetLabelHeight) || 1.0,
            ...assetLabelOptions(brandingDraft)
          }
        })
      });

      setSettings(data.settings);
      setBrandingDraft({
        appName: data.settings.branding.appName || "VGC Shelf",
        pageTitle: data.settings.branding.pageTitle || "VGC Shelf",
        appIconUrl: data.settings.branding.appIconUrl || "",
        assetTagPrefix: data.settings.branding.assetTagPrefix || "VGC",
        labelText: data.settings.branding.labelText || "",
        assetLabelWidth: Number(data.settings.branding.assetLabelWidth) || 2.25,
        assetLabelHeight: Number(data.settings.branding.assetLabelHeight) || 1.0,
        ...assetLabelOptions(data.settings.branding)
      });

      applyBranding({
        appName: data.settings.branding.appName || "VGC Shelf",
        pageTitle: data.settings.branding.pageTitle || data.settings.branding.appName || "VGC Shelf",
        appIconUrl: data.settings.branding.appIconUrl || "/vgcs-icon.png",
        assetTagPrefix: data.settings.branding.assetTagPrefix || "VGC",
        labelText: data.settings.branding.labelText || "",
        assetLabelWidth: Number(data.settings.branding.assetLabelWidth) || 2.25,
        assetLabelHeight: Number(data.settings.branding.assetLabelHeight) || 1.0,
        ...assetLabelOptions(data.settings.branding)
      });

      setMessage("Branding saved.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save branding.");
    }
  }

  async function toggleSignup() {
    if (!settings) return;

    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ allowPublicSignup: !settings.allowPublicSignup })
      });

      setSettings(data.settings);
      setMessage(`Public signup ${data.settings.allowPublicSignup ? "enabled" : "disabled"}.`);
    } catch (err: any) {
      setMessage(err.message || "Failed to update signup setting.");
    }
  }

  async function saveApiKeys(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const apiKeys: Record<string, string | null> = {};

    for (const [key, value] of Object.entries(apiKeyDraft)) {
      if (value.trim().length > 0) apiKeys[key] = value.trim();
    }

    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ apiKeys })
      });

      setSettings(data.settings);
      setApiKeyDraft(blankApiKeys());
      setMessage("API settings saved. Stored keys are masked after save.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save API settings.");
    }
  }

  async function clearApiKey(key: keyof ApiKeys) {
    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ apiKeys: { [key]: "" } })
      });

      setSettings(data.settings);
      setMessage("Stored API key cleared.");
    } catch (err: any) {
      setMessage(err.message || "Failed to clear API key.");
    }
  }

  async function saveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const port = Number(smtpDraft.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setMessage("SMTP port must be between 1 and 65535.");
      return;
    }

    const smtp: Record<string, string | number | boolean | null> = {
      host: smtpDraft.host.trim() || null,
      port,
      secure: smtpDraft.secure,
      user: smtpDraft.user.trim() || null,
      from: smtpDraft.from.trim() || null
    };
    if (smtpDraft.password.length > 0) smtp.password = smtpDraft.password;

    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ smtp })
      });
      setSettings(data.settings);
      setSmtpDraft((prev) => ({ ...prev, password: "" }));
      setMessage(data.settings.smtp.configured ? "SMTP settings saved. Lending email reminders are enabled." : "SMTP settings saved, but host and From address are required to enable reminders.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save SMTP settings.");
    }
  }

  async function clearSmtpPassword() {
    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ smtp: { password: null } })
      });
      setSettings(data.settings);
      setSmtpDraft((prev) => ({ ...prev, password: "" }));
      setMessage("Stored SMTP password cleared.");
    } catch (err: any) {
      setMessage(err.message || "Failed to clear SMTP password.");
    }
  }

  async function saveLendingReminders(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const days = Number(reminderDraft.days);
    const repeatDays = Number(reminderDraft.repeatDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      setMessage("Reminder timing must be between 0 and 365 days.");
      return;
    }
    if (!Number.isInteger(repeatDays) || repeatDays < 0 || repeatDays > 365) {
      setMessage("Repeat interval must be between 0 and 365 days.");
      return;
    }
    if (!reminderDraft.subject.trim() || !reminderDraft.message.trim()) {
      setMessage("Reminder subject and message cannot be blank.");
      return;
    }

    try {
      const data = await api<{ settings: Settings }>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          lendingReminders: {
            enabled: reminderDraft.enabled,
            timing: reminderDraft.timing,
            days,
            repeatDays,
            subject: reminderDraft.subject,
            message: reminderDraft.message
          }
        })
      });
      setSettings(data.settings);
      setMessage("Lending reminder settings saved.");
    } catch (err: any) {
      setMessage(err.message || "Failed to save lending reminder settings.");
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: name || undefined,
          password,
          role
        })
      });

      setEmail("");
      setName("");
      setPassword("Password123!");
      setRole("USER");
      setMessage("User created.");
      await loadUsers();
    } catch (err: any) {
      setMessage(err.message || "Failed to create user.");
    }
  }

  async function updateRole(userId: string, newRole: "ADMIN" | "USER") {
    setMessage("");

    try {
      await api(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole })
      });

      setMessage("User role updated.");
      await loadUsers();
    } catch (err: any) {
      setMessage(err.message || "Failed to update user role.");
    }
  }

  async function resetUserPassword(userId: string) {
    setMessage("");

    const newPassword = resetPasswords[userId];

    if (!newPassword || newPassword.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }

    try {
      await api(`/admin/users/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword })
      });

      setResetPasswords((prev) => ({ ...prev, [userId]: "" }));
      setMessage("User password reset.");
    } catch (err: any) {
      setMessage(err.message || "Failed to reset password.");
    }
  }

  async function deleteUser(user: AdminUser) {
    setMessage("");

    if (!confirm(`Delete user ${user.email}? This cannot be undone.`)) return;

    try {
      await api(`/admin/users/${user.id}`, {
        method: "DELETE"
      });

      setMessage("User deleted.");
      await loadUsers();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete user.");
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
    load();
  }, []);

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold">Branding</h2>

            <form onSubmit={saveBranding} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">App Name</span>
                <Input
                  placeholder="VGC Shelf"
                  value={brandingDraft.appName}
                  onChange={(e) => setBrandingDraft((prev) => ({ ...prev, appName: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Browser/Page Title</span>
                <Input
                  placeholder="VGC Shelf"
                  value={brandingDraft.pageTitle}
                  onChange={(e) => setBrandingDraft((prev) => ({ ...prev, pageTitle: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Asset Label Text</span>
                <Input
                  placeholder="VGC Shelf"
                  value={brandingDraft.labelText || ""}
                  onChange={(e) => setBrandingDraft((prev) => ({ ...prev, labelText: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">App Icon URL</span>
                <Input
                  placeholder="https://example.com/icon.png"
                  value={brandingDraft.appIconUrl || ""}
                  onChange={(e) => setBrandingDraft((prev) => ({ ...prev, appIconUrl: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Asset Tag Prefix</span>
                <Input
                  placeholder="VGC"
                  value={brandingDraft.assetTagPrefix || ""}
                  onChange={(e) => setBrandingDraft((prev) => ({ ...prev, assetTagPrefix: normalizePrefix(e.target.value) }))}
                  maxLength={3}
                />
                <span className="vgc-muted mt-1 block text-xs text-zinc-400">
                  Exactly 3 letters or numbers. Example: {(brandingDraft.assetTagPrefix || "VGC").padEnd(3, "X")}-GAME-0001
                </span>
              </label>

              <div className="space-y-3">
                <span className="block text-sm font-medium">Asset Label Size</span>
                <select
                  className="vgc-select"
                  style={{ colorScheme: "light" }}
                  value={`${brandingDraft.assetLabelWidth || 2.25}x${brandingDraft.assetLabelHeight || 1}`}
                  onChange={(e) => {
                    if (e.target.value === "custom") return;
                    const [width, height] = e.target.value.split("x").map(Number);
                    setBrandingDraft((prev) => ({
                      ...prev,
                      assetLabelWidth: width,
                      assetLabelHeight: height
                    }));
                  }}
                >
                  <option value="2.25x1">2.25 × 1.00 inches</option>
                  <option value="2.25x1.25">2.25 × 1.25 inches</option>
                  <option value="2.25x1.5">2.25 × 1.50 inches</option>
                  <option value="2x1">2.00 × 1.00 inches</option>
                  <option value="3.5x1.125">3.50 × 1.125 inches</option>
                  {!["2.25x1", "2.25x1.25", "2.25x1.5", "2x1", "3.5x1.125"].includes(
                    `${brandingDraft.assetLabelWidth || 2.25}x${brandingDraft.assetLabelHeight || 1}`
                  ) && <option value={`${brandingDraft.assetLabelWidth}x${brandingDraft.assetLabelHeight}`}>Custom</option>}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium">Width in inches</span>
                    <Input
                      type="number"
                      min="0.5"
                      max="6"
                      step="0.001"
                      value={brandingDraft.assetLabelWidth || 2.25}
                      onChange={(e) => setBrandingDraft((prev) => ({
                        ...prev,
                        assetLabelWidth: Number(e.target.value)
                      }))}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium">Height in inches</span>
                    <Input
                      type="number"
                      min="0.5"
                      max="6"
                      step="0.001"
                      value={brandingDraft.assetLabelHeight || 1}
                      onChange={(e) => setBrandingDraft((prev) => ({
                        ...prev,
                        assetLabelHeight: Number(e.target.value)
                      }))}
                    />
                  </label>
                </div>

                <div>
                  <span className="mb-2 block text-sm font-medium">Information shown</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {assetLabelFields.map((field) => (
                      <label
                        key={field.key}
                        className="flex min-h-11 items-center gap-3 rounded-xl border border-zinc-700 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={brandingDraft[field.key] ?? assetLabelOptions({})[field.key]}
                          onChange={(e) =>
                            setBrandingDraft((prev) => ({
                              ...prev,
                              [field.key]: e.target.checked
                            }))
                          }
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Button type="submit">Save branding</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-bold">Admin Settings</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">Control account creation.</p>

            <div className="vgc-surface mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="font-semibold">Public signup</div>
              <p className="vgc-muted mt-1 text-sm text-zinc-400">
                Current status:{" "}
                <span className={settings?.allowPublicSignup ? "text-green-300" : "text-red-300"}>
                  {settings?.allowPublicSignup ? "Enabled" : "Disabled"}
                </span>
              </p>

              <Button className="mt-4" onClick={toggleSignup}>
                {settings?.allowPublicSignup ? "Disable signup" : "Enable signup"}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Create User</h2>

            <form onSubmit={createUser} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Name</span>
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Temporary Password</span>
                <Input placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Role</span>
                <select
                  className="vgc-select"
                  style={{ colorScheme: "light" }}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>

              <Button type="submit">Create user</Button>
            </form>
          </Card>

          <Card>
            <div className="mb-5 flex items-center gap-3">
              <DatabaseBackup className="h-6 w-6 vgc-accent-text" />
              <div>
                <h2 className="text-xl font-bold">Full Database Backup</h2>
                <p className="vgc-muted text-sm text-zinc-400">Admin-only full export/import for disaster recovery.</p>
              </div>
            </div>

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
          </Card>
        </section>

        <section className="space-y-6">
          <Card>
            <h2 className="text-xl font-bold">API Keys</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">
              Existing keys are masked. Enter a new value to replace one, or clear a field using the clear button.
            </p>
            <form onSubmit={saveApiKeys} className="mt-5 grid gap-4 md:grid-cols-2">
              {apiKeyFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="block text-sm font-medium">{field.label}</label>
                  <div className="vgc-muted text-xs text-zinc-400">
                    Stored: {settings?.apiKeys?.[field.key] || "Not set"}
                  </div>

                  <Input
                    type={field.type || "password"}
                    placeholder={field.placeholder || "Enter new value"}
                    value={apiKeyDraft[field.key]}
                    onChange={(e) => setApiKeyDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />

                  {settings?.apiKeys?.[field.key] && (
                    <button type="button" onClick={() => clearApiKey(field.key)} className="text-xs text-red-300 hover:text-red-200">
                      Clear stored value
                    </button>
                  )}
                </div>
              ))}

              <div className="md:col-span-2">
                <Button type="submit">Save API settings</Button>
              </div>
            </form>
          </Card>


          <Card>
            <h2 className="text-xl font-bold">SMTP Email</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">
              Used for lending reminders. Automatic overdue checks run every six hours.
            </p>

            <form onSubmit={saveSmtp} className="mt-5 space-y-4">
              <div className="rounded-xl border border-zinc-800 p-3 text-sm">
                Status: <span className={settings?.smtp?.configured ? "text-green-300" : "text-amber-300"}>
                  {settings?.smtp?.configured ? "Configured" : "Not configured"}
                </span>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">SMTP Host</span>
                <Input placeholder="smtp.example.com" value={smtpDraft.host} onChange={(e) => setSmtpDraft((prev) => ({ ...prev, host: e.target.value }))} />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Port</span>
                  <Input type="number" min={1} max={65535} value={smtpDraft.port} onChange={(e) => setSmtpDraft((prev) => ({ ...prev, port: e.target.value }))} />
                </label>

                <label className="flex items-center gap-2 pt-7 text-sm">
                  <input type="checkbox" checked={smtpDraft.secure} onChange={(e) => setSmtpDraft((prev) => ({ ...prev, secure: e.target.checked }))} />
                  Use implicit TLS/SSL
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Username</span>
                <Input placeholder="Optional" value={smtpDraft.user} onChange={(e) => setSmtpDraft((prev) => ({ ...prev, user: e.target.value }))} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Password</span>
                <div className="vgc-muted mb-2 text-xs text-zinc-400">Stored: {settings?.smtp?.password || "Not set"}</div>
                <Input type="password" placeholder="Leave blank to keep current password" value={smtpDraft.password} onChange={(e) => setSmtpDraft((prev) => ({ ...prev, password: e.target.value }))} />
                {settings?.smtp?.password && (
                  <button type="button" onClick={clearSmtpPassword} className="mt-2 text-xs text-red-300 hover:text-red-200">Clear stored password</button>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">From Address</span>
                <Input placeholder="VGC Shelf <vgc-shelf@example.com>" value={smtpDraft.from} onChange={(e) => setSmtpDraft((prev) => ({ ...prev, from: e.target.value }))} />
              </label>

              <p className="vgc-muted text-xs text-zinc-400">Use port 465 with implicit TLS. For port 587, leave implicit TLS off so STARTTLS can be negotiated.</p>
              <Button type="submit">Save SMTP settings</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-bold">Lending Reminders</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">
              Control automatic reminder timing and customize the plain-text email sent to borrowers. Manual reminders use the same template.
            </p>

            <form onSubmit={saveLendingReminders} className="mt-5 space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-zinc-800 p-3 text-sm">
                <input type="checkbox" checked={reminderDraft.enabled} onChange={(e) => setReminderDraft((prev) => ({ ...prev, enabled: e.target.checked }))} />
                Send automatic lending reminders
              </label>

              <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">First reminder</span>
                  <select className="vgc-select w-full" value={reminderDraft.timing} onChange={(e) => setReminderDraft((prev) => ({ ...prev, timing: e.target.value as "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE" }))}>
                    <option value="BEFORE_DUE">Before the due date</option>
                    <option value="ON_DUE">On the due date</option>
                    <option value="AFTER_DUE">After the due date</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Days</span>
                  <Input type="number" min={0} max={365} value={reminderDraft.days} disabled={reminderDraft.timing === "ON_DUE"} onChange={(e) => setReminderDraft((prev) => ({ ...prev, days: e.target.value }))} />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Repeat every</span>
                <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <Input type="number" min={0} max={365} value={reminderDraft.repeatDays} onChange={(e) => setReminderDraft((prev) => ({ ...prev, repeatDays: e.target.value }))} />
                  <span className="vgc-muted text-sm text-zinc-400">days after the previous reminder. Use 0 to send only once.</span>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email subject</span>
                <Input value={reminderDraft.subject} onChange={(e) => setReminderDraft((prev) => ({ ...prev, subject: e.target.value }))} />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email message</span>
                <textarea className="vgc-input min-h-56 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" value={reminderDraft.message} onChange={(e) => setReminderDraft((prev) => ({ ...prev, message: e.target.value }))} />
              </label>

              <div className="rounded-xl border border-zinc-800 p-3 text-xs text-zinc-400">
                Available placeholders: <code>{"{{borrowerName}}"}</code>, <code>{"{{borrowerEmail}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{assetTag}}"}</code>, <code>{"{{collectionName}}"}</code>, <code>{"{{dueDate}}"}</code>, and <code>{"{{checkoutDate}}"}</code>.
              </div>

              <Button type="submit">Save reminder settings</Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-xl font-bold">Users</h2>

            {users.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
                No users loaded. If this persists, check the backend logs.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">{user.email}</div>
                        <div className="vgc-muted text-sm text-zinc-400">{user.name || "No name"} · {user.role}</div>
                      </div>

                      <select
                        className="vgc-select md:w-40"
                        style={{ colorScheme: "light" }}
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value as "ADMIN" | "USER")}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <Input
                        type="password"
                        placeholder="New password"
                        value={resetPasswords[user.id] || ""}
                        onChange={(e) => setResetPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      />

                      <Button type="button" onClick={() => resetUserPassword(user.id)}>
                        Reset password
                      </Button>

                      <button
                        type="button"
                        onClick={() => deleteUser(user)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>

      {message && <p className="mt-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
    </Shell>
  );
}
