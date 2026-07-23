"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL, api, Collection, CollectionType, getToken, publicAssetUrl } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Shell } from "@/components/Shell";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  Download,
  Gamepad2,
  GripVertical,
  ImagePlus,
  Joystick,
  Package,
  Pin,
  PinOff,
  Plus,
  SquarePlus,
  Tags
} from "lucide-react";

type CollectionSort = "manual" | "name-asc" | "name-desc" | "type-asc" | "recent" | "oldest" | "items-desc";

type SortableCollection = Collection & {
  createdAt?: string;
  updatedAt?: string;
  sortOrder?: number;
  isPinned?: boolean;
  isArchived?: boolean;
  archivedAt?: string | null;
};

const collectionSortOptions: Array<{ value: CollectionSort; label: string }> = [
  { value: "manual", label: "Manual order" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "type-asc", label: "Type" },
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "items-desc", label: "Most items" }
];

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

function collectionItemCount(collection: SortableCollection) {
  if (collection.type === "GAMES") return collection._count?.copies ?? 0;
  return collection._count?.items ?? 0;
}

function itemLabel(collection: SortableCollection) {
  const count = collectionItemCount(collection);
  const noun = collection.type === "GAMES" ? "game" : "item";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function checkedOutLabel(collection: SortableCollection) {
  const count = collection.checkedOutCount ?? 0;
  return `${count} checked out`;
}

function CollectionCover({ collection }: { collection: SortableCollection }) {
  if (collection.imageUrl) {
    return (
      <img
        src={publicAssetUrl(collection.imageUrl)}
        alt=""
        className="aspect-[16/9] w-full rounded-xl border border-zinc-800 bg-zinc-950 object-cover"
      />
    );
  }

  return (
    <div className="aspect-[16/9] w-full rounded-xl border border-dashed border-zinc-700 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-4">
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">{typeIcon(collection.type)}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">No cover image</div>
      </div>
    </div>
  );
}

function QuickActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-center gap-1 rounded-lg border border-zinc-800 px-2 py-2 text-xs font-semibold text-zinc-300 hover:vgc-accent-border hover:vgc-accent-text"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<SortableCollection[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [type, setType] = useState<CollectionType>("GAMES");
  const [sort, setSort] = useState<CollectionSort>("manual");
  const [showArchived, setShowArchived] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [message, setMessage] = useState("");
  const draggedIdRef = useRef<string | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  async function load() {
    const data = await api<{ collections: SortableCollection[] }>("/collections");
    setCollections(data.collections);
  }

  async function exportCollectionCsv(collection: SortableCollection) {
    setMessage("");

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/backup/collections/${collection.id}/export.csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to export collection.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = collection.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "collection";
      link.href = url;
      link.download = `${safeName}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.message || "Failed to export collection.");
    }
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

  async function updateCollection(collection: SortableCollection, changes: { isPinned?: boolean; isArchived?: boolean }) {
    setMessage("");

    try {
      await api(`/collections/${collection.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes)
      });
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to update collection.");
    }
  }

  async function saveOrder(nextCollections: SortableCollection[]) {
    const editable = nextCollections.filter((collection) => collection.role === "OWNER" || collection.role === "EDITOR");
    if (editable.length === 0) return;

    setSavingOrder(true);
    setMessage("");

    try {
      await api("/collections/order", {
        method: "PATCH",
        body: JSON.stringify({ collectionIds: editable.map((collection) => collection.id) })
      });
    } catch (err: any) {
      setMessage(err.message || "Failed to save collection order.");
      await load();
    } finally {
      setSavingOrder(false);
    }
  }

  function previewCollectionMove(sourceId: string, targetId: string) {
    if (sourceId === targetId || sort !== "manual") return;

    const active = collections.filter((collection) => !collection.isArchived);
    const dragged = active.find((collection) => collection.id === sourceId);
    const target = active.find((collection) => collection.id === targetId);
    if (!dragged || !target || dragged.isPinned !== target.isPinned) return;

    const section = active.filter((collection) => Boolean(collection.isPinned) === Boolean(dragged.isPinned));
    const fromIndex = section.findIndex((collection) => collection.id === sourceId);
    const toIndex = section.findIndex((collection) => collection.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reorderedSection = [...section];
    const [moved] = reorderedSection.splice(fromIndex, 1);
    reorderedSection.splice(toIndex, 0, moved);

    const replacement = new Map(reorderedSection.map((collection, index) => [collection.id, index]));
    setCollections((current) =>
      current.map((collection) =>
        replacement.has(collection.id) ? { ...collection, sortOrder: replacement.get(collection.id)! } : collection
      )
    );
  }

  function beginCollectionDrag(event: React.PointerEvent<HTMLButtonElement>, collectionId: string) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    pointerIdRef.current = event.pointerId;
    draggedIdRef.current = collectionId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedId(collectionId);
    setDragOverId(null);
  }

  function moveCollectionDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const sourceId = draggedIdRef.current;
    if (!sourceId || pointerIdRef.current !== event.pointerId) return;

    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-collection-card-id]");
    const targetId = target?.dataset.collectionCardId;

    if (!targetId || targetId === sourceId) {
      setDragOverId(null);
      return;
    }

    setDragOverId(targetId);
    previewCollectionMove(sourceId, targetId);
  }

  function finishCollectionDrag(event?: React.PointerEvent<HTMLButtonElement>) {
    const sourceId = draggedIdRef.current;
    if (!sourceId) return;

    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const dragged = collections.find((collection) => collection.id === sourceId);
    if (dragged) {
      const reorderedSection = collections
        .filter(
          (collection) =>
            !collection.isArchived && Boolean(collection.isPinned) === Boolean(dragged.isPinned)
        )
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      void saveOrder(reorderedSection);
    }

    draggedIdRef.current = null;
    pointerIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const visibleCollections = useMemo(() => {
    const timeFor = (collection: SortableCollection, field: "createdAt" | "updatedAt") => {
      const rawValue = collection[field];
      return rawValue ? new Date(rawValue).getTime() : 0;
    };

    const filtered = collections.filter((collection) => Boolean(collection.isArchived) === showArchived);

    return [...filtered].sort((a, b) => {
      if (!showArchived && a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sort === "manual") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "type-asc") {
        const typeCompare = typeLabel(a.type).localeCompare(typeLabel(b.type));
        return typeCompare || a.name.localeCompare(b.name);
      }
      if (sort === "recent") return timeFor(b, "createdAt") - timeFor(a, "createdAt");
      if (sort === "oldest") return timeFor(a, "createdAt") - timeFor(b, "createdAt");
      if (sort === "items-desc") {
        const countCompare = collectionItemCount(b) - collectionItemCount(a);
        return countCompare || a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [collections, showArchived, sort]);

  const pinnedCollections = visibleCollections.filter((collection) => !showArchived && collection.isPinned);
  const regularCollections = visibleCollections.filter((collection) => showArchived || !collection.isPinned);

  function CollectionCard({ collection }: { collection: SortableCollection }) {
    const canEdit = collection.role === "OWNER" || collection.role === "EDITOR";
    const draggable = canEdit && sort === "manual" && !showArchived;

    return (
      <article
        data-collection-card-id={collection.id}
        className={`vgc-surface rounded-xl border bg-zinc-950 p-4 transition-[transform,border-color,box-shadow,opacity] duration-150 hover:vgc-accent-border ${
          draggedId === collection.id
            ? "scale-[0.985] border-zinc-500 opacity-75 shadow-2xl"
            : dragOverId === collection.id
              ? "scale-[1.01] vgc-accent-border shadow-lg"
              : "border-zinc-800"
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {draggable && (
              <button
                type="button"
                aria-label={`Drag ${collection.name} to reorder`}
                title="Grab and move to reorder"
                onPointerDown={(event) => beginCollectionDrag(event, collection.id)}
                onPointerMove={moveCollectionDrag}
                onPointerUp={finishCollectionDrag}
                onPointerCancel={finishCollectionDrag}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className={`-m-2 flex touch-none select-none items-center gap-1 rounded-lg p-2 transition-colors ${
                  draggedId === collection.id
                    ? "cursor-grabbing bg-zinc-800 text-zinc-100"
                    : "cursor-grab text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 active:cursor-grabbing"
                }`}
              >
                <GripVertical className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Move</span>
              </button>
            )}
            {savingOrder && sort === "manual" ? "Saving order..." : sort === "manual" ? "Grab Move and drag" : ""}
          </div>

          <div className="flex items-center gap-1">
            {!showArchived && (
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => updateCollection(collection, { isPinned: !collection.isPinned })}
                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:vgc-accent-border hover:vgc-accent-text disabled:cursor-not-allowed disabled:opacity-40"
                title={collection.isPinned ? "Unpin collection" : "Pin collection"}
              >
                {collection.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}

            <button
              type="button"
              disabled={!canEdit}
              onClick={() => updateCollection(collection, { isArchived: !collection.isArchived })}
              className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:vgc-accent-border hover:vgc-accent-text disabled:cursor-not-allowed disabled:opacity-40"
              title={collection.isArchived ? "Restore collection" : "Archive collection"}
            >
              {collection.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <a href={`/collections/${collection.id}`} className="block">
          <CollectionCover collection={collection} />

          <div className="mb-3 mt-3 flex items-center gap-2">
            {typeIcon(collection.type)}
            <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs">{typeLabel(collection.type)}</span>
            {collection.isPinned && !showArchived && (
              <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">Pinned</span>
            )}
            {collection.isArchived && (
              <span className="rounded-full border border-amber-800 px-2 py-1 text-xs text-amber-300">Archived</span>
            )}
          </div>

          <h3 className="font-semibold">{collection.name}</h3>
          <p className="vgc-muted mt-1 line-clamp-2 min-h-10 text-sm text-zinc-400">{collection.description || "No description"}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
              <div className="font-semibold text-zinc-100">{itemLabel(collection)}</div>
              <div className="vgc-muted mt-1 text-zinc-500">Tracked</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
              <div className="font-semibold text-zinc-100">{checkedOutLabel(collection)}</div>
              <div className="vgc-muted mt-1 text-zinc-500">Lending</div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2">
              <div className="font-semibold text-zinc-100">{collection._count?.members ?? 0}</div>
              <div className="vgc-muted mt-1 text-zinc-500">Members</div>
            </div>
          </div>

          <div className="vgc-muted mt-3 text-xs text-zinc-500">Your role: {collection.role}</div>
        </a>

        {!collection.isArchived && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickActionLink href={`/collections/${collection.id}?action=add`} icon={<SquarePlus className="h-3.5 w-3.5" />} label="Add" />
            <QuickActionLink href={`/assets?collectionId=${collection.id}`} icon={<Tags className="h-3.5 w-3.5" />} label="Tags" />
            <button
              type="button"
              onClick={() => exportCollectionCsv(collection)}
              className="flex items-center justify-center gap-1 rounded-lg border border-zinc-800 px-2 py-2 text-xs font-semibold text-zinc-300 hover:vgc-accent-border hover:vgc-accent-text"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
            <QuickActionLink href={`/reports?collectionId=${collection.id}`} icon={<BarChart3 className="h-3.5 w-3.5" />} label="Reports" />
          </div>
        )}
      </article>
    );
  }

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="order-2 lg:order-1">
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
                <p className="vgc-muted mt-2 text-xs text-zinc-400">{imageFile ? imageFile.name : "Using pasted image URL"}</p>
              )}
            </div>

            <select className="vgc-select" style={{ colorScheme: "light" }} value={type} onChange={(e) => setType(e.target.value as CollectionType)}>
              {collectionTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <p className="vgc-muted text-xs text-zinc-400">{collectionTypes.find((item) => item.value === type)?.description}</p>

            <Button type="submit" className="w-full" disabled={isUploading}>{isUploading ? "Uploading..." : "Create collection"}</Button>
          </form>

          {message && <p className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}
        </Card>

        <Card className="order-1 lg:order-2">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-xl font-bold">{showArchived ? "Archived Collections" : "Collections"}</h2>
              <p className="vgc-muted mt-1 text-sm text-zinc-400">
                {showArchived ? "Restore archived collections when they are needed again." : "Pin important collections and drag them into your preferred order."}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:vgc-accent-border hover:vgc-accent-text"
              >
                {showArchived ? "Show Active" : `Show Archived (${collections.filter((collection) => collection.isArchived).length})`}
              </button>

              <label className="flex flex-col gap-1 text-sm sm:min-w-44">
                <span className="vgc-muted text-xs font-semibold uppercase tracking-wide text-zinc-500">Sort collections</span>
                <select className="vgc-select" style={{ colorScheme: "light" }} value={sort} onChange={(e) => setSort(e.target.value as CollectionSort)}>
                  {collectionSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!showArchived && pinnedCollections.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2">
                <Pin className="h-4 w-4 vgc-accent-text" />
                <h3 className="font-semibold">Pinned</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {pinnedCollections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
              </div>
            </section>
          )}

          <section className="mt-6">
            {!showArchived && pinnedCollections.length > 0 && <h3 className="mb-3 font-semibold">Collections</h3>}
            <div className="grid gap-4 md:grid-cols-2">
              {regularCollections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
            </div>
          </section>

          {visibleCollections.length === 0 && (
            <p className="mt-5 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
              {showArchived ? "No archived collections." : "No collections yet."}
            </p>
          )}
        </Card>
      </div>
    </Shell>
  );
}
