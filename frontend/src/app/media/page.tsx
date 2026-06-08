"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { Image } from "lucide-react";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MediaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [message, setMessage] = useState("");

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setUploadedUrl("");

    if (!file) {
      setMessage("Choose an image first.");
      return;
    }

    try {
      const dataBase64 = await readFileAsBase64(file);
      const result = await api<{ url: string }>("/uploads/image", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 })
      });

      setUploadedUrl(result.url);
      setMessage("Image uploaded.");
    } catch (err: any) {
      setMessage(err.message || "Upload failed.");
    }
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(uploadedUrl);
    setMessage("Image URL copied.");
  }

  return (
    <Shell>
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <Image className="h-6 w-6 vgc-accent-text" />
          <div>
            <h2 className="text-xl font-bold">Media Uploads</h2>
            <p className="vgc-muted text-sm text-zinc-400">
              Upload cover images or item photos, then paste the returned URL into a game or item image field.
            </p>
          </div>
        </div>

        <form onSubmit={upload} className="space-y-4">
          <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button type="submit">Upload image</Button>
        </form>

        {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}

        {uploadedUrl && (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 text-sm font-semibold">Uploaded image URL</div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input readOnly value={uploadedUrl} />
              <Button type="button" onClick={copyUrl}>Copy URL</Button>
            </div>
            <img src={uploadedUrl} alt="" className="mt-4 max-h-80 rounded-xl border border-zinc-800 object-contain" />
          </div>
        )}
      </Card>
    </Shell>
  );
}
