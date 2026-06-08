"use client";

import { useEffect, useState } from "react";
import { api, Collection, CollectionType, publicAssetUrl } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import { Archive, Gamepad2, ImagePlus, Joystick, Package, Plus } from "lucide-react";

const collectionTypes: Array<{ value: CollectionType; label: string; description: string }> = [
  { value: "GAMES", label: "Games", description: "Physical and digital video games" },
  { value: "SYSTEMS", label: "Systems", description: "Consoles and handheld systems" },
  { value: "PERIPHERALS", label: "Peripherals", description: "Controllers, adapters, accessories, memory cards" },
  { value: "TOYS_TO_LIFE", label: "Toys-to-life", description: "Amiibo, Skylanders, Disney Infinity, etc." }
];


function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadImage(file: File) {
  const dataBase64 = await readFileAsBase64(file);
  const result = await api<{ url: string }>("/uploads/image", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 })
  });
  return result.url;
}

function typeLabel(type: CollectionType) {
  return collectionTypes.find((item) => item.value === type)?.label || type.replaceAll("_", " ");
}

function typeIcon(type: CollectionType) {
  if (type === "GAMES") return <Gamepad2 className="h-5 w-5 vgc-accent-text" />;
  if (type === "SYSTEMS") return <Archive className="h-5 w-5 vgc-accent-text" />;
  if (type === "PERIPHERALS") return <Joystick className="h-5 w-5 vgc-accent-text" />;
  return <Package className="h-5 w-5 vgc-accent-text" />;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [type, setType] = useState<CollectionType>("GAMES");
  const [message, setMessage] = useState("");

  async function load() {
    const data = await api<{ collections: Collection[] }>("/collections");
    setCollections(data.collections);
  }

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      let uploadedImageUrl = imageUrl.trim();

      if (imageFile) {
        setIsUploading(true);
        uploadedImageUrl = await uploadImage(imageFile);
      }

      await api("/collections", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          imageUrl: uploadedImageUrl || undefined,
          type
        })
      });

      setName("");
      setDescription("");
      setImageUrl("");
      setImageFile(null);
      setType("GAMES");
      setMessage("Collection created.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to create collection.");
    } finally {
      setIsUploading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 vgc-accent-text" />
            <h2 className="text-xl font-bold">Create Collection</h2>
          </div>

          <form onSubmit={createCollection} className="space-y-3">
            <Input placeholder="Collection name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ImagePlus className="h-4 w-4 vgc-accent-text" />
                Collection image
              </div>
              <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              <Input className="mt-2" placeholder="Or paste image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              {(imageFile || imageUrl) && (
                <p className="vgc-muted mt-2 text-xs text-zinc-400">
                  {imageFile ? imageFile.name : "Using pasted image URL"}
                </p>
              )}
            </div>

            <select className="vgc-select" style={{ colorScheme: "light" }} value={type} onChange={(e) => setType(e.target.value as CollectionType)}>
              {collectionTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <p className="vgc-muted text-xs text-zinc-400">
              {collectionTypes.find((item) => item.value === type)?.description}
            </p>

            <Button type="submit" className="w-full" disabled={isUploading}>{isUploading ? "Uploading..." : "Create collection"}</Button>
          </form>

          {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Collections</h2>
          <p className="vgc-muted mt-1 text-sm text-zinc-400">
            Each collection tracks one type of thing.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {collections.map((collection) => (
              <a key={collection.id} href={`/collections/${collection.id}`} className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:vgc-accent-border">
                {collection.imageUrl ? (
                  <img src={publicAssetUrl(collection.imageUrl)} alt="" className="mb-3 h-32 w-full rounded-xl border border-zinc-800 object-cover" />
                ) : null}

                <div className="mb-3 flex items-center gap-2">
                  {typeIcon(collection.type)}
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">{typeLabel(collection.type)}</span>
                </div>

                <h3 className="font-semibold">{collection.name}</h3>
                <p className="vgc-muted mt-1 text-sm text-zinc-400">{collection.description || "No description"}</p>

                <div className="vgc-muted mt-3 text-xs text-zinc-500">
                  {collection.type === "GAMES"
                    ? `${collection._count?.copies ?? 0} games`
                    : `${collection._count?.items ?? 0} items`} · {collection._count?.members ?? 0} members · {collection.role}
                </div>
              </a>
            ))}
          </div>

          {collections.length === 0 && (
            <p className="mt-5 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
              No collections yet.
            </p>
          )}
        </Card>
      </div>
    </Shell>
  );
}
