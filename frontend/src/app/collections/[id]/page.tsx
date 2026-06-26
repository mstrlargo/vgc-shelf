"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { api, Collection, CollectionItem, CollectionMember, CollectionType, DuplicateGroup, DuplicateItem, GameCopy, MetadataResult, Platform, User, publicAssetUrl } from "@/lib/api";
import { Branding, loadBranding } from "@/lib/branding";
import { AssetPanel } from "@/components/AssetPanel";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Shell } from "@/components/Shell";
import { Archive, Camera, ChevronDown, Disc3, DollarSign, Gamepad2, Joystick, Package, Search, Tag, Trash2, UserPlus, Users } from "lucide-react";

type CollectionResponse = {
  collection: Collection & {
    members: CollectionMember[];
    copies: GameCopy[];
    items: CollectionItem[];
  };
  role: "OWNER" | "EDITOR" | "VIEWER";
};

type SortOption =
  | "title-asc"
  | "title-desc"
  | "value-high"
  | "value-low"
  | "price-high"
  | "price-low"
  | "year-new"
  | "year-old";

type SellListSummary = {
  id: string;
  sourceId?: string | null;
  askingPrice?: string | number | null;
  status?: "AVAILABLE" | "SOLD" | "HOLD";
};

type GamePartType = "DISC" | "CARTRIDGE" | "BOX" | "MANUAL" | "INSERT" | "COVER_ART" | "STEELBOOK" | "AMIIBO" | "SEALED" | "OTHER";
type ConditionGrade = "NEW" | "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE" | "POOR" | "MISSING";
type PriceChartingCondition = "loose" | "cib" | "new" | "manual" | "box" | "graded";

type PriceChartingProductMatch = {
  id: string;
  productName: string;
  consoleName: string;
  prices: Partial<Record<PriceChartingCondition, number | null>>;
};

type PartDraft = {
  type: GamePartType;
  enabled: boolean;
  condition: ConditionGrade;
  notes: string;
};

const partOptions: Array<{ type: GamePartType; label: string; priceChartingRole?: "media" | "box" | "manual" | "sealed" }> = [
  { type: "DISC", label: "Disc / Game Media", priceChartingRole: "media" },
  { type: "CARTRIDGE", label: "Cartridge / Game Media", priceChartingRole: "media" },
  { type: "BOX", label: "Box / Original Packaging", priceChartingRole: "box" },
  { type: "MANUAL", label: "Manual", priceChartingRole: "manual" },
  { type: "SEALED", label: "New / Sealed", priceChartingRole: "sealed" },
  { type: "INSERT", label: "Insert" },
  { type: "COVER_ART", label: "Cover Art" },
  { type: "STEELBOOK", label: "Steelbook" },
  { type: "AMIIBO", label: "Amiibo" },
  { type: "OTHER", label: "Other" }
];

const priceChartingConditionLabels: Record<PriceChartingCondition, string> = {
  loose: "Loose / game only",
  cib: "Complete in Box (game + box + manual)",
  new: "New / sealed",
  manual: "Manual only",
  box: "Box only",
  graded: "Graded"
};

const conditionOptions: Array<{ value: ConditionGrade; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like New" },
  { value: "VERY_GOOD", label: "Very Good" },
  { value: "GOOD", label: "Good" },
  { value: "ACCEPTABLE", label: "Acceptable" },
  { value: "POOR", label: "Poor" },
  { value: "MISSING", label: "Missing" }
];

const collectionTypes: Array<{ value: CollectionType; label: string }> = [
  { value: "GAMES", label: "Games" },
  { value: "SYSTEMS", label: "Systems" },
  { value: "PERIPHERALS", label: "Peripherals" },
  { value: "TOYS_TO_LIFE", label: "Toys-to-life" }
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

function defaultPartDrafts(): PartDraft[] {
  return partOptions.map((part) => ({ type: part.type, enabled: false, condition: "GOOD", notes: "" }));
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function deltaLabel(current: unknown, paid: unknown) {
  const delta = Number(current || 0) - Number(paid || 0);
  if (!Number.isFinite(delta) || (!current && !paid)) return null;
  return { text: `${delta >= 0 ? "+" : ""}${money(delta)}`, className: delta >= 0 ? "text-green-300" : "text-red-300" };
}

function partLabel(type: string) {
  return partOptions.find((part) => part.type === type)?.label || type.replaceAll("_", " ");
}

function conditionLabel(condition: string) {
  return conditionOptions.find((item) => item.value === condition)?.label || condition.replaceAll("_", " ");
}

function collectionTypeLabel(type?: CollectionType) {
  return collectionTypes.find((item) => item.value === type)?.label || "Games";
}

function itemNoun(type?: CollectionType) {
  if (type === "SYSTEMS") return "System";
  if (type === "PERIPHERALS") return "Peripheral";
  if (type === "TOYS_TO_LIFE") return "Toy-to-life";
  return "Item";
}


function MobileCollapsibleCard({
  title,
  icon,
  children,
  defaultMobileOpen = false
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultMobileOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultMobileOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-3 text-left md:pointer-events-none ${isOpen ? "mb-4" : "mb-0 md:mb-4"}`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform md:hidden ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div className={`${isOpen ? "block" : "hidden"} md:block`}>
        {children}
      </div>
    </Card>
  );
}

function collectionIcon(type?: CollectionType) {
  if (type === "SYSTEMS") return <Archive className="h-5 w-5 vgc-accent-text" />;
  if (type === "PERIPHERALS") return <Joystick className="h-5 w-5 vgc-accent-text" />;
  if (type === "TOYS_TO_LIFE") return <Package className="h-5 w-5 vgc-accent-text" />;
  return <Gamepad2 className="h-5 w-5 vgc-accent-text" />;
}

type BarcodeDetectorType = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorType;
  }
}

export default function CollectionManagementPage({ params }: { params: { id: string } }) {
  const [collection, setCollection] = useState<CollectionResponse["collection"] | null>(null);
  const [role, setRole] = useState<"OWNER" | "EDITOR" | "VIEWER">("VIEWER");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBranding] = useState<Branding>({ appName: "VGC Shelf", pageTitle: "VGC Shelf", appIconUrl: null });
  const [message, setMessage] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("title-asc");
  const [sellListIds, setSellListIds] = useState<string[]>([]);
  const [sellListBySourceId, setSellListBySourceId] = useState<Record<string, SellListSummary>>({});
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateItem[]>([]);

  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionImageUrl, setCollectionImageUrl] = useState("");
  const [collectionImageFile, setCollectionImageFile] = useState<File | null>(null);
  const [isUploadingCollectionImage, setIsUploadingCollectionImage] = useState(false);
  const [collectionType, setCollectionType] = useState<CollectionType>("GAMES");
  const [showCollectionModal, setShowCollectionModal] = useState(false);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"EDITOR" | "VIEWER" | "OWNER">("VIEWER");

  const [metadataQuery, setMetadataQuery] = useState("");
  const [metadataProvider, setMetadataProvider] = useState("all");
  const [metadataResults, setMetadataResults] = useState<MetadataResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [barcode, setBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanStopRef = useRef(false);

  const [title, setTitle] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [newPlatformName, setNewPlatformName] = useState("");
  const [region, setRegion] = useState("NTSC-U");
  const [edition, setEdition] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [priceChartingProductId, setPriceChartingProductId] = useState("");
  const [priceChartingProductName, setPriceChartingProductName] = useState("");
  const [priceChartingConsoleName, setPriceChartingConsoleName] = useState("");
  const [priceChartingMatches, setPriceChartingMatches] = useState<PriceChartingProductMatch[]>([]);
  const [selectedPriceChartingProduct, setSelectedPriceChartingProduct] = useState<PriceChartingProductMatch | null>(null);
  const [isPriceChartingSearching, setIsPriceChartingSearching] = useState(false);
  const [format, setFormat] = useState<"PHYSICAL" | "DIGITAL">("PHYSICAL");
  const [partDrafts, setPartDrafts] = useState<PartDraft[]>(defaultPartDrafts());
  const [autoUpdatePriceCharting, setAutoUpdatePriceCharting] = useState(false);
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemMaker, setItemMaker] = useState("");
  const [itemPlatform, setItemPlatform] = useState("");
  const [itemModelNumber, setItemModelNumber] = useState("");
  const [itemSerialNumber, setItemSerialNumber] = useState("");
  const [itemBarcode, setItemBarcode] = useState("");
  const [itemCondition, setItemCondition] = useState<ConditionGrade>("GOOD");
  const [itemPricePaid, setItemPricePaid] = useState("");
  const [itemCurrentValue, setItemCurrentValue] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  const canEdit = role === "OWNER" || role === "EDITOR";
  const canDeleteCollection = role === "OWNER";
  const isGamesCollection = collection?.type === "GAMES";

  async function load() {
    const [collectionData, platformData, meData, brandingData] = await Promise.all([
      api<CollectionResponse>(`/collections/${params.id}`),
      api<{ platforms: Platform[] }>("/platforms"),
      api<{ user: User }>("/auth/me").catch(() => ({ user: null as unknown as User })),
      loadBranding()
    ]);

    setCollection(collectionData.collection);
    setRole(collectionData.role);
    setPlatforms(platformData.platforms);
    setUser(meData.user);
    setBranding(brandingData);
    setCollectionName(collectionData.collection.name);
    setCollectionDescription(collectionData.collection.description || "");
    setCollectionImageUrl(collectionData.collection.imageUrl || "");
    setCollectionImageFile(null);
    setCollectionType(collectionData.collection.type || "GAMES");

    try {
      const duplicateData = await api<{ duplicates: DuplicateGroup[] }>(`/duplicates/collections/${params.id}/duplicates`);
      setDuplicateGroups(duplicateData.duplicates);
    } catch {
      setDuplicateGroups([]);
    }

    if (!platformId && platformData.platforms[0]) setPlatformId(platformData.platforms[0].id);
  }

  function selectedPartsPayload() {
    if (format !== "PHYSICAL") return [];
    return partDrafts.filter((part) => part.enabled).map((part) => ({ type: part.type, condition: part.condition, notes: part.notes || undefined }));
  }

  function priceChartingCondition(): PriceChartingCondition {
    if (format === "DIGITAL") return "loose";

    const enabledParts = partDrafts.filter((part) => part.enabled);
    const hasGameMedia = enabledParts.some((part) => part.type === "DISC" || part.type === "CARTRIDGE");
    const hasBox = enabledParts.some((part) => part.type === "BOX" || part.type === "COVER_ART" || part.type === "STEELBOOK");
    const hasManual = enabledParts.some((part) => part.type === "MANUAL");
    const hasSealed = enabledParts.some((part) => part.type === "SEALED");
    const isNew = hasSealed || (hasGameMedia && enabledParts.some((part) => part.condition === "NEW"));

    if (isNew) return "new";
    if (hasGameMedia && hasBox && hasManual) return "cib";
    if (!hasGameMedia && hasManual && !hasBox) return "manual";
    if (!hasGameMedia && hasBox && !hasManual) return "box";

    return "loose";
  }

  function priceChartingConditionLabel() {
    return priceChartingConditionLabels[priceChartingCondition()];
  }

  function selectedPlatformName() {
    return (newPlatformName || platforms.find((p) => p.id === platformId)?.name || "").trim();
  }

  function resetGameForm() {
    setTitle("");
    setReleaseYear("");
    setDescription("");
    setCoverUrl("");
    setNewPlatformName("");
    setEdition("");
    setPricePaid("");
    setCurrentValue("");
    setPriceChartingProductId("");
    setPriceChartingProductName("");
    setPriceChartingConsoleName("");
    setPriceChartingMatches([]);
    setSelectedPriceChartingProduct(null);
    setRegion("NTSC-U");
    setBarcode("");
    setFormat("PHYSICAL");
    setPartDrafts(defaultPartDrafts());
    setAutoUpdatePriceCharting(false);
    setEditingCopyId(null);
    setMetadataResults([]);
  }

  function resetItemForm() {
    setEditingItemId(null);
    setItemName("");
    setItemMaker("");
    setItemPlatform("");
    setItemModelNumber("");
    setItemSerialNumber("");
    setItemBarcode("");
    setItemCondition("GOOD");
    setItemPricePaid("");
    setItemCurrentValue("");
    setItemImageUrl("");
    setItemNotes("");
  }

  function updatePart(type: GamePartType, patch: Partial<PartDraft>) {
    setPartDrafts((current) => current.map((part) => {
      if (part.type !== type) return part;
      const nextPart = { ...part, ...patch };
      if (type === "SEALED" && patch.enabled) {
        return { ...nextPart, condition: "NEW" };
      }
      return nextPart;
    }));
  }

  useEffect(() => {
    if (!showGameModal || !autoUpdatePriceCharting || format !== "PHYSICAL") return;
    const timer = window.setTimeout(() => {
      void fetchPriceChartingForGame(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [showGameModal, autoUpdatePriceCharting, format, partDrafts, title, platformId, newPlatformName, barcode]);

  async function saveCollection(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      let nextImageUrl = collectionImageUrl.trim();

      if (collectionImageFile) {
        setIsUploadingCollectionImage(true);
        nextImageUrl = await uploadImage(collectionImageFile);
      }

      await api(`/collections/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: collectionName, description: collectionDescription || null, imageUrl: nextImageUrl || null, type: collectionType })
      });
      setShowCollectionModal(false);
      setMessage("Collection updated.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to update collection.");
    } finally {
      setIsUploadingCollectionImage(false);
    }
  }

  async function deleteCollection() {
    if (!confirm("Delete this collection and all items inside it? This cannot be undone.")) return;
    setMessage("");
    try {
      await api(`/collections/${params.id}`, { method: "DELETE" });
      window.location.href = "/collections";
    } catch (err: any) {
      setMessage(err.message || "Failed to delete collection.");
    }
  }

  async function searchMetadata(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (metadataQuery.trim().length < 2) {
      setMessage("Enter at least 2 characters to search.");
      return;
    }
    setIsSearching(true);
    try {
      const data = await api<{ results: MetadataResult[]; errors: Array<{ provider: string; error: string }> }>(
        `/metadata/search?q=${encodeURIComponent(metadataQuery)}&provider=${encodeURIComponent(metadataProvider)}`
      );
      setMetadataResults(data.results);
      if (data.results.length === 0) setMessage("No metadata results found.");
    } catch (err: any) {
      setMessage(err.message || "Metadata search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  function priceChartingSearchQuery() {
    const platformName = selectedPlatformName();
    if (barcode.trim()) return `upc=${encodeURIComponent(barcode.trim())}`;
    const q = [title.trim(), platformName].filter(Boolean).join(" ").trim();
    return q ? `q=${encodeURIComponent(q)}` : "";
  }

  async function selectPriceChartingMatch(match: PriceChartingProductMatch) {
    setPriceChartingProductId(match.id);
    setPriceChartingProductName(match.productName);
    setPriceChartingConsoleName(match.consoleName);
    setSelectedPriceChartingProduct(match);
    setMessage(`Selected PriceCharting match: ${match.productName}${match.consoleName ? ` (${match.consoleName})` : ""}. Loading condition prices...`);

    try {
      const data = await api<{ product: PriceChartingProductMatch }>(`/metadata/pricecharting/product?productId=${encodeURIComponent(match.id)}`);
      const detailed = data.product || match;
      setSelectedPriceChartingProduct(detailed);
      setPriceChartingProductName(detailed.productName || match.productName);
      setPriceChartingConsoleName(detailed.consoleName || match.consoleName);
      setPriceChartingMatches((existing) => existing.map((item) => item.id === detailed.id ? detailed : item));
      const selectedCondition = priceChartingCondition();
      const value = detailed.prices?.[selectedCondition];
      if (typeof value === "number" && value > 0) {
        setCurrentValue(String(value));
        setMessage(`Selected PriceCharting match: ${detailed.productName}${detailed.consoleName ? ` (${detailed.consoleName})` : ""}. ${priceChartingConditionLabels[selectedCondition]} price loaded: ${money(value)}.`);
      } else {
        setMessage(`Selected PriceCharting match: ${detailed.productName}${detailed.consoleName ? ` (${detailed.consoleName})` : ""}. Use Autofill after choosing the component condition.`);
      }
    } catch (err: any) {
      setMessage(err.message || "Selected PriceCharting match, but condition prices could not be loaded yet. Autofill can still try the saved product ID.");
    }
  }

  async function searchPriceChartingProducts() {
    setMessage("");
    const query = priceChartingSearchQuery();
    if (!query) {
      setMessage("Enter a game title, platform, or barcode before searching PriceCharting.");
      return;
    }
    setIsPriceChartingSearching(true);
    try {
      const data = await api<{ products: PriceChartingProductMatch[] }>(`/metadata/pricecharting/products?${query}`);
      setPriceChartingMatches(data.products || []);
      setSelectedPriceChartingProduct(null);
      if (!data.products || data.products.length === 0) {
        setMessage("No PriceCharting matches found. Try a shorter title or search with the console name.");
      }
    } catch (err: any) {
      setMessage(err.message || "PriceCharting product search failed.");
    } finally {
      setIsPriceChartingSearching(false);
    }
  }

  async function fetchPriceChartingForGame(showMessage = true) {
    if (showMessage) setMessage("");

    if (!priceChartingProductId && !barcode.trim()) {
      if (showMessage) setMessage("Search PriceCharting and select the correct product match first.");
      return false;
    }

    const query = new URLSearchParams();
    if (priceChartingProductId) query.set("productId", priceChartingProductId);
    else if (barcode.trim()) query.set("upc", barcode.trim());

    try {
      const selectedCondition = priceChartingCondition();
      query.set("condition", selectedCondition);
      const data = await api<{ result: { currentValue: number; condition: PriceChartingCondition; priceLabel?: string; productId?: string; productName?: string | null; consoleName?: string | null; priceKey?: string } }>(`/metadata/pricecharting/value?${query.toString()}`);
      setCurrentValue(String(data.result.currentValue));
      if (data.result.productId) setPriceChartingProductId(String(data.result.productId));
      if (data.result.productName) setPriceChartingProductName(data.result.productName);
      if (data.result.consoleName) setPriceChartingConsoleName(data.result.consoleName);
      const productNote = [data.result.productName || priceChartingProductName, data.result.consoleName || priceChartingConsoleName].filter(Boolean).join(" / ");
      const label = data.result.priceLabel || priceChartingConditionLabels[data.result.condition] || priceChartingConditionLabel();
      if (showMessage || autoUpdatePriceCharting) {
        setMessage(`Current Value filled from PriceCharting ${label}${productNote ? ` for ${productNote}` : ""}: ${money(data.result.currentValue)}.`);
      }
      return true;
    } catch (err: any) {
      if (showMessage) setMessage(err.message || "PriceCharting lookup failed.");
      return false;
    }
  }

  async function lookupPriceChartingForGame() {
    const updated = await fetchPriceChartingForGame(true);
    if (updated) setAutoUpdatePriceCharting(true);
  }

  async function lookupPriceChartingForItem() {
    setMessage("");
    const queryText = `${itemName} ${itemPlatform}`.trim();
    const query = itemBarcode ? `upc=${encodeURIComponent(itemBarcode)}` : `q=${encodeURIComponent(queryText)}`;
    if (!itemBarcode && !queryText) {
      setMessage("Enter an item name or barcode first.");
      return;
    }
    try {
      const itemPriceCondition: PriceChartingCondition = itemCondition === "NEW" ? "new" : "loose";
      const data = await api<{ result: { currentValue: number; condition: PriceChartingCondition; priceLabel?: string } }>(`/metadata/pricecharting/value?${query}&condition=${itemPriceCondition}`);
      setItemCurrentValue(String(data.result.currentValue));
      setMessage(`Current Value filled from PriceCharting ${data.result.priceLabel || priceChartingConditionLabels[data.result.condition] || "Loose / game only"}: ${money(data.result.currentValue)}.`);
    } catch (err: any) {
      setMessage(err.message || "PriceCharting lookup failed.");
    }
  }

  async function checkDuplicates(payload?: { title?: string; platformName?: string; barcode?: string; format?: string; itemName?: string; modelNumber?: string; serialNumber?: string }) {
    try {
      const data = await api<{ matches: DuplicateItem[] }>(`/duplicates/collections/${params.id}/duplicates/check`, {
        method: "POST",
        body: JSON.stringify(payload || {
          title,
          platformName: newPlatformName || platforms.find((platform) => platform.id === platformId)?.name || "",
          barcode,
          format,
          itemName,
          modelNumber: itemModelNumber,
          serialNumber: itemSerialNumber
        })
      });
      setDuplicateMatches(data.matches);
      if (data.matches.length > 0) {
        setMessage(`Possible duplicate found: ${data.matches[0].title}${data.matches.length > 1 ? ` and ${data.matches.length - 1} more` : ""}. Review before saving.`);
      }
      return data.matches;
    } catch {
      setDuplicateMatches([]);
      return [];
    }
  }

  async function lookupBarcode(code = barcode) {
    setMessage("");
    if (code.trim().length < 4) {
      setMessage("Enter or scan a valid barcode first.");
      return;
    }
    setIsSearching(true);
    try {
      const data = await api<{ results: MetadataResult[]; errors: Array<{ provider: string; error: string }> }>(`/metadata/barcode?code=${encodeURIComponent(code.trim())}`);
      setMetadataResults(data.results);
      await checkDuplicates({ barcode: code.trim() });
      if (data.results.length === 0) setMessage("No metadata found for that barcode. You can still save it manually.");
    } catch (err: any) {
      setMessage(err.message || "Barcode lookup failed.");
    } finally {
      setIsSearching(false);
    }
  }

  function useMetadata(result: MetadataResult) {
    if (!isGamesCollection) return;
    setTitle(result.title || "");
    setReleaseYear(result.releaseYear ? String(result.releaseYear) : "");
    setDescription(result.description || "");
    setCoverUrl(result.coverUrl || "");
    if (result.barcode) setBarcode(result.barcode);
    if (result.platformName) {
      const existing = platforms.find((platform) => platform.name.toLowerCase() === result.platformName!.toLowerCase());
      if (existing) {
        setPlatformId(existing.id);
        setNewPlatformName("");
      } else {
        setPlatformId("");
        setNewPlatformName(result.platformName);
      }
    }
    setShowGameModal(true);
    checkDuplicates({ title: result.title, platformName: result.platformName || "", barcode: result.barcode || barcode, format });
    setMessage(`Loaded metadata from ${result.provider}. Review before saving.`);
  }

  async function startBarcodeScanner() {
    setMessage("");
    if (!window.BarcodeDetector) {
      setMessage("Barcode scanning is not supported by this browser. Use Chrome/Edge or enter the barcode manually.");
      return;
    }
    try {
      scanStopRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setIsScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      const scan = async () => {
        if (scanStopRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue;
            setBarcode(raw);
            setItemBarcode(raw);
            stopBarcodeScanner();
            if (isGamesCollection) await lookupBarcode(raw);
            return;
          }
        } catch {}
        requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);
    } catch (err: any) {
      setMessage(err.message || "Unable to start camera.");
      stopBarcodeScanner();
    }
  }

  function stopBarcodeScanner() {
    scanStopRef.current = true;
    setIsScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      await api(`/collections/${params.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail, role: memberRole })
      });
      setMemberEmail("");
      setMemberRole("VIEWER");
      setMessage("Person added to collection.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to add person.");
    }
  }

  async function saveGame(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      if (!editingCopyId) {
        await checkDuplicates({
          title,
          platformName: newPlatformName || platforms.find((platform) => platform.id === platformId)?.name || "",
          barcode,
          format
        });
      }
      const parts = selectedPartsPayload();
      if (editingCopyId) {
        await api(`/copies/${editingCopyId}`, {
          method: "PATCH",
          body: JSON.stringify({
            barcode: barcode || null,
            region: region || null,
            edition: edition || null,
            purchasePrice: pricePaid ? Number(pricePaid) : null,
            estimatedValue: currentValue ? Number(currentValue) : null,
            priceChartingProductId: priceChartingProductId || null,
            priceChartingProductName: priceChartingProductName || null,
            priceChartingConsoleName: priceChartingConsoleName || null,
            format,
            parts,
            game: {
              title,
              releaseYear: releaseYear ? Number(releaseYear) : null,
              description: description || null,
              coverUrl: coverUrl || null,
              platformId: newPlatformName.trim() ? null : platformId || null,
              platformName: newPlatformName.trim() || null
            }
          })
        });
        setMessage("Game updated.");
      } else {
        await api(`/collections/${params.id}/games`, {
          method: "POST",
          body: JSON.stringify({
            title,
            releaseYear: releaseYear ? Number(releaseYear) : undefined,
            description: description || undefined,
            coverUrl: coverUrl || undefined,
            platformId: newPlatformName.trim() ? undefined : platformId || undefined,
            platformName: newPlatformName.trim() || undefined,
            barcode: barcode || undefined,
            region,
            edition: edition || undefined,
            purchasePrice: pricePaid ? Number(pricePaid) : undefined,
            estimatedValue: currentValue ? Number(currentValue) : undefined,
            priceChartingProductId: priceChartingProductId || undefined,
            priceChartingProductName: priceChartingProductName || undefined,
            priceChartingConsoleName: priceChartingConsoleName || undefined,
            format,
            parts
          })
        });
        setMessage("Game added to collection.");
      }
      resetGameForm();
      setShowGameModal(false);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to save game.");
    }
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      if (!editingItemId) {
        await checkDuplicates({
          itemName,
          platformName: itemPlatform,
          barcode: itemBarcode,
          modelNumber: itemModelNumber,
          serialNumber: itemSerialNumber
        });
      }
      const payload = {
        name: itemName,
        maker: itemMaker || null,
        platform: itemPlatform || null,
        modelNumber: itemModelNumber || null,
        serialNumber: itemSerialNumber || null,
        barcode: itemBarcode || null,
        condition: itemCondition,
        purchasePrice: itemPricePaid ? Number(itemPricePaid) : null,
        estimatedValue: itemCurrentValue ? Number(itemCurrentValue) : null,
        imageUrl: itemImageUrl || null,
        notes: itemNotes || null
      };

      if (editingItemId) {
        await api(`/items/${editingItemId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage(`${itemNoun(collection?.type)} updated.`);
      } else {
        await api(`/collections/${params.id}/items`, { method: "POST", body: JSON.stringify(payload) });
        setMessage(`${itemNoun(collection?.type)} added.`);
      }

      resetItemForm();
      setShowItemModal(false);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to save item.");
    }
  }

  function editCopy(copy: GameCopy) {
    setEditingCopyId(copy.id);
    setTitle(copy.game.title);
    setReleaseYear(copy.game.releaseYear ? String(copy.game.releaseYear) : "");
    setDescription(copy.game.description || "");
    setCoverUrl(copy.game.coverUrl || "");
    setPlatformId(copy.game.platform?.id || "");
    setNewPlatformName("");
    setBarcode(copy.barcode || "");
    setRegion(copy.region || "");
    setEdition(copy.edition || "");
    setPricePaid(copy.purchasePrice ? String(copy.purchasePrice) : "");
    setCurrentValue(copy.estimatedValue ? String(copy.estimatedValue) : "");
    setPriceChartingProductId(copy.priceChartingProductId || "");
    setPriceChartingProductName(copy.priceChartingProductName || "");
    setPriceChartingConsoleName(copy.priceChartingConsoleName || "");
    setPriceChartingMatches([]);
    setFormat(copy.format);
    const nextParts = defaultPartDrafts();
    for (const existingPart of copy.parts || []) {
      const normalizedType = existingPart.type === "CASE" ? "BOX" : existingPart.type;
      const index = nextParts.findIndex((part) => part.type === normalizedType);
      if (index >= 0) {
        nextParts[index] = { type: normalizedType as GamePartType, enabled: true, condition: existingPart.condition as ConditionGrade, notes: existingPart.notes || "" };
      }
    }
    setPartDrafts(nextParts);
    setShowGameModal(true);
  }

  function editItem(item: CollectionItem) {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemMaker(item.maker || "");
    setItemPlatform(item.platform || "");
    setItemModelNumber(item.modelNumber || "");
    setItemSerialNumber(item.serialNumber || "");
    setItemBarcode(item.barcode || "");
    setItemCondition(item.condition as ConditionGrade);
    setItemPricePaid(item.purchasePrice ? String(item.purchasePrice) : "");
    setItemCurrentValue(item.estimatedValue ? String(item.estimatedValue) : "");
    setItemImageUrl(item.imageUrl || "");
    setItemNotes(item.notes || "");
    setShowItemModal(true);
  }

  async function deleteCopy(copyId: string) {
    if (!confirm("Delete this game copy from the collection?")) return;
    setMessage("");
    try {
      await api(`/copies/${copyId}`, { method: "DELETE" });
      setMessage("Game copy deleted.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete game copy.");
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm(`Delete this ${itemNoun(collection?.type).toLowerCase()} from the collection?`)) return;
    setMessage("");
    try {
      await api(`/items/${itemId}`, { method: "DELETE" });
      setMessage(`${itemNoun(collection?.type)} deleted.`);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete item.");
    }
  }

  function sortedCopies(copies: GameCopy[]) {
    const next = [...copies];

    switch (sortBy) {
      case "title-desc":
        return next.sort((a, b) => b.game.title.localeCompare(a.game.title));
      case "value-high":
        return next.sort((a, b) => Number(b.estimatedValue || 0) - Number(a.estimatedValue || 0));
      case "value-low":
        return next.sort((a, b) => Number(a.estimatedValue || 0) - Number(b.estimatedValue || 0));
      case "price-high":
        return next.sort((a, b) => Number(b.purchasePrice || 0) - Number(a.purchasePrice || 0));
      case "price-low":
        return next.sort((a, b) => Number(a.purchasePrice || 0) - Number(b.purchasePrice || 0));
      case "year-new":
        return next.sort((a, b) => Number(b.game.releaseYear || 0) - Number(a.game.releaseYear || 0));
      case "year-old":
        return next.sort((a, b) => Number(a.game.releaseYear || 0) - Number(b.game.releaseYear || 0));
      default:
        return next.sort((a, b) => a.game.title.localeCompare(b.game.title));
    }
  }

  function sortedItems(items: CollectionItem[]) {
    const next = [...items];

    switch (sortBy) {
      case "title-desc":
        return next.sort((a, b) => b.name.localeCompare(a.name));
      case "value-high":
        return next.sort((a, b) => Number(b.estimatedValue || 0) - Number(a.estimatedValue || 0));
      case "value-low":
        return next.sort((a, b) => Number(a.estimatedValue || 0) - Number(b.estimatedValue || 0));
      case "price-high":
        return next.sort((a, b) => Number(b.purchasePrice || 0) - Number(a.purchasePrice || 0));
      case "price-low":
        return next.sort((a, b) => Number(a.purchasePrice || 0) - Number(b.purchasePrice || 0));
      default:
        return next.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  async function loadSellListIds() {
    try {
      const data = await api<{ items: SellListSummary[] }>("/lists/sell-list");
      const bySourceId: Record<string, SellListSummary> = {};

      for (const item of data.items) {
        if (item.sourceId) {
          bySourceId[item.sourceId] = item;
        }
      }

      setSellListBySourceId(bySourceId);
      setSellListIds(Object.keys(bySourceId));
    } catch {
      setSellListBySourceId({});
      setSellListIds([]);
    }
  }

  async function addGameCopyToSellList(copy: GameCopy) {
    setMessage("");

    try {
      await api(`/lists/sell-list/from-game-copy/${copy.id}`, {
        method: "POST",
        body: JSON.stringify({
          askingPrice: copy.estimatedValue || copy.purchasePrice || null
        })
      });

      await loadSellListIds();
      setMessage(`${copy.game.title} added to Sell List.`);
    } catch (err: any) {
      setMessage(err.message || "Failed to add game to Sell List.");
    }
  }

  async function addCollectionItemToSellList(item: CollectionItem) {
    setMessage("");

    try {
      await api(`/lists/sell-list/from-collection-item/${item.id}`, {
        method: "POST",
        body: JSON.stringify({
          askingPrice: item.estimatedValue || item.purchasePrice || null
        })
      });

      await loadSellListIds();
      setMessage(`${item.name} added to Sell List.`);
    } catch (err: any) {
      setMessage(err.message || `Failed to add ${itemNoun(collection?.type).toLowerCase()} to Sell List.`);
    }
  }

  async function removeFromSellList(sourceId: string, title: string) {
    const sellItem = sellListBySourceId[sourceId];

    if (!sellItem) return;
    if (!confirm(`Remove ${title} from the Sell List?`)) return;

    setMessage("");

    try {
      await api(`/lists/sell-list/${sellItem.id}`, {
        method: "DELETE"
      });

      await loadSellListIds();
      setMessage(`${title} removed from Sell List.`);
    } catch (err: any) {
      setMessage(err.message || "Failed to remove from Sell List.");
    }
  }

  async function updateSellListPrice(sourceId: string, title: string) {
    const sellItem = sellListBySourceId[sourceId];

    if (!sellItem) return;

    const nextPrice = window.prompt("Asking price", sellItem.askingPrice ? String(sellItem.askingPrice) : "");

    if (nextPrice === null) return;

    setMessage("");

    try {
      await api(`/lists/sell-list/${sellItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          askingPrice: nextPrice.trim() || null
        })
      });

      await loadSellListIds();
      setMessage(`Updated asking price for ${title}.`);
    } catch (err: any) {
      setMessage(err.message || "Failed to update asking price.");
    }
  }

  useEffect(() => {
    load()
      .then(() => loadSellListIds())
      .catch((err) => setMessage(err.message));

    return () => stopBarcodeScanner();
  }, [params.id]);

  return (
    <Shell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <a href="/collections" className="vgc-accent-text text-sm hover:opacity-80">← Back to collections</a>
          <div className="mt-2 flex items-center gap-3">
            {collection?.imageUrl ? (
              <img src={publicAssetUrl(collection.imageUrl)} alt="" className="h-16 w-16 rounded-2xl border border-zinc-800 object-cover" />
            ) : (
              collectionIcon(collection?.type)
            )}
            <div>
              <h2 className="text-3xl font-bold">{collection?.name || "Collection"}</h2>
              <p className="vgc-muted text-sm text-zinc-400">{collectionTypeLabel(collection?.type)} · {collection?.description || "No description"} · Your role: {role}</p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setShowCollectionModal(true)}>Edit collection</Button>
            {isGamesCollection ? (
              <Button type="button" onClick={() => { resetGameForm(); setShowGameModal(true); }}>Add game</Button>
            ) : (
              <Button type="button" onClick={() => { resetItemForm(); setShowItemModal(true); }}>Add {itemNoun(collection?.type)}</Button>
            )}
            {canDeleteCollection && <button type="button" onClick={deleteCollection} className="rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950">Delete collection</button>}
          </div>
        )}
      </div>

      {message && <p className="mb-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[430px_1fr]">
        <section className="space-y-6">
          <MobileCollapsibleCard title="Barcode" icon={<Camera className="h-5 w-5 vgc-accent-text" />}>
            {canEdit ? (
              <div className="space-y-3">
                <Input placeholder="UPC/EAN barcode" value={isGamesCollection ? barcode : itemBarcode} onChange={(e) => { setBarcode(e.target.value); setItemBarcode(e.target.value); }} />
                <div className="grid grid-cols-2 gap-2">
                  {isGamesCollection && <Button type="button" onClick={() => lookupBarcode()} disabled={isSearching}>Lookup barcode</Button>}
                  <Button type="button" onClick={isScanning ? stopBarcodeScanner : startBarcodeScanner}>{isScanning ? "Stop scanner" : "Scan barcode"}</Button>
                </div>
                {isScanning && <video ref={videoRef} className="aspect-video w-full rounded-xl bg-black" muted playsInline />}
                {duplicateMatches.length > 0 && <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100"><div className="font-semibold">Possible duplicate</div>{duplicateMatches.slice(0, 3).map((match) => <div key={`${match.type}-${match.id}`} className="mt-1">{match.title}{match.platform ? ` · ${match.platform}` : ""}{match.assetTag?.tag ? ` · ${match.assetTag.tag}` : ""} <span className="text-amber-300">({match.reason})</span></div>)}</div>}
              </div>
            ) : <p className="rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">You have viewer access.</p>}
          </MobileCollapsibleCard>

          {isGamesCollection && (
            <MobileCollapsibleCard title="Search Game Metadata" icon={<Search className="h-5 w-5 vgc-accent-text" />}>
              {canEdit ? (
                <>
                  <form onSubmit={searchMetadata} className="space-y-3">
                    <Input placeholder="Search game metadata" value={metadataQuery} onChange={(e) => setMetadataQuery(e.target.value)} />
                    <select className="vgc-select" style={{ colorScheme: "light" }} value={metadataProvider} onChange={(e) => setMetadataProvider(e.target.value)}>
                      <option value="all">All configured providers</option><option value="rawg">RAWG</option><option value="igdb">IGDB</option><option value="giantbomb">GiantBomb</option><option value="mobygames">MobyGames</option><option value="steam">Steam</option><option value="custom">Custom</option>
                    </select>
                    <Button type="submit" className="w-full" disabled={isSearching}>{isSearching ? "Searching..." : "Search metadata"}</Button>
                  </form>
                  <div className="mt-4 space-y-3">
                    {metadataResults.map((result) => (
                      <button key={`${result.provider}-${result.externalId}`} type="button" onClick={() => useMetadata(result)} className="vgc-surface w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left hover:vgc-accent-border">
                        <div className="flex gap-3">
                          {result.coverUrl && <img src={result.coverUrl} alt="" className="h-16 w-12 rounded object-cover" />}
                          <div><div className="font-semibold">{result.title}</div><div className="vgc-muted text-xs text-zinc-400">{result.provider}{result.releaseYear ? ` · ${result.releaseYear}` : ""}{result.platformName ? ` · ${result.platformName}` : ""}</div>{result.description && <p className="vgc-muted mt-1 line-clamp-2 text-xs text-zinc-400">{result.description}</p>}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : <p className="rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">You have viewer access.</p>}
            </MobileCollapsibleCard>
          )}

          <Card>
            <div className="mb-4 flex items-center gap-2"><Tag className="h-5 w-5 vgc-accent-text" /><h3 className="text-lg font-semibold">Duplicate Check</h3></div>
            {duplicateGroups.length === 0 ? (
              <p className="rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">No likely duplicates detected.</p>
            ) : (
              <div className="space-y-3">
                {duplicateGroups.slice(0, 5).map((group) => (
                  <div key={group.key} className="rounded-xl border border-amber-800 bg-amber-950/20 p-3 text-sm">
                    <div className="font-semibold text-amber-200">{group.reason}</div>
                    <div className="mt-2 space-y-1 text-zinc-200">
                      {group.items.map((item) => <div key={`${item.type}-${item.id}`}>{item.title}{item.platform ? ` · ${item.platform}` : ""}{item.barcode ? ` · ${item.barcode}` : ""}{item.assetTag?.tag ? ` · ${item.assetTag.tag}` : ""}</div>)}
                    </div>
                  </div>
                ))}
                {duplicateGroups.length > 5 && <p className="text-xs text-zinc-400">Showing 5 of {duplicateGroups.length} duplicate groups.</p>}
              </div>
            )}
          </Card>

          <MobileCollapsibleCard title="Add Person to Collection" icon={<UserPlus className="h-5 w-5 vgc-accent-text" />}>
            {canEdit ? (
              <form onSubmit={addMember} className="space-y-3">
                <Input type="email" placeholder="User email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                <select className="vgc-select" style={{ colorScheme: "light" }} value={memberRole} onChange={(e) => setMemberRole(e.target.value as "OWNER" | "EDITOR" | "VIEWER")}>
                  <option value="VIEWER">Viewer</option><option value="EDITOR">Editor</option>{role === "OWNER" && <option value="OWNER">Owner</option>}
                </select>
                <Button type="submit" className="w-full">Add person</Button>
              </form>
            ) : <p className="rounded-lg bg-zinc-800 p-3 text-sm text-zinc-300">You have viewer access.</p>}
          </MobileCollapsibleCard>

          <Card>
            <div className="mb-4 flex items-center gap-2"><Users className="h-5 w-5 vgc-accent-text" /><h3 className="text-lg font-semibold">Members</h3></div>
            <div className="space-y-2">{collection?.members.map((member) => <div key={member.id} className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="font-medium">{member.user.email}</div><div className="vgc-muted text-sm text-zinc-400">{member.user.name || "No name"} · {member.role}</div></div>)}</div>
          </Card>
        </section>

        <section className="space-y-6">
          {isGamesCollection ? (
            <Card>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold">Games in this Collection</h3>
                <label className="block md:w-64">
                  <span className="mb-1 block text-sm font-medium">Sort</span>
                  <select className="vgc-select" style={{ colorScheme: "light" }} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                    <option value="title-asc">Title A-Z</option>
                    <option value="title-desc">Title Z-A</option>
                    <option value="year-new">Release year newest</option>
                    <option value="year-old">Release year oldest</option>
                    <option value="value-high">Current value high-low</option>
                    <option value="value-low">Current value low-high</option>
                    <option value="price-high">Price paid high-low</option>
                    <option value="price-low">Price paid low-high</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {sortedCopies(collection?.copies || []).map((copy) => {
                  const delta = deltaLabel(copy.estimatedValue, copy.purchasePrice);
                  return (
                    <div key={copy.id} className="vgc-surface rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
                      <div className="flex items-start gap-3">{copy.game.coverUrl ? <img src={copy.game.coverUrl} alt="" className="h-20 w-14 rounded object-cover" /> : <Disc3 className="mt-1 h-5 w-5 vgc-accent-text" />}<div><h4 className="font-semibold">{copy.game.title}</h4><p className="vgc-muted text-sm text-zinc-400">{copy.game.platform?.name || "Unknown platform"} · {copy.format}</p>{copy.game.releaseYear && <p className="vgc-muted text-xs text-zinc-400">{copy.game.releaseYear}</p>}</div></div>
                      {copy.game.description && <p className="vgc-muted mt-3 line-clamp-3 text-sm text-zinc-400">{copy.game.description}</p>}
                      <p className="vgc-muted mt-2 text-sm text-zinc-400">{copy.region || "No region"} {copy.edition ? `· ${copy.edition}` : ""}</p>
                      {copy.barcode && <p className="vgc-muted mt-1 text-xs text-zinc-400">Barcode: {copy.barcode}</p>}
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm"><p>Price Paid: {copy.purchasePrice ? money(copy.purchasePrice) : "—"}</p><p>Current Value: {copy.estimatedValue ? money(copy.estimatedValue) : "—"}</p>{delta && <p className={delta.className}>Change: {delta.text}</p>}</div>
                      <div className="mt-3 flex flex-wrap gap-2">{copy.parts.map((part) => <span key={part.id} title={part.notes || ""} className="rounded-full bg-zinc-800 px-2 py-1 text-xs">{partLabel(part.type)}: {conditionLabel(part.condition)}</span>)}{copy.format === "PHYSICAL" && copy.parts.length === 0 && <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-400">No parts tracked</span>}</div>
                      <AssetPanel assetTag={copy.assetTag} gameCopyId={copy.id} collectionType="GAMES" canEdit={canEdit} user={user} branding={branding} onChanged={load} />
                      {canEdit && (
                        <div className="mt-3 space-y-2">
                          {sellListBySourceId[copy.id] ? (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <button type="button" onClick={() => updateSellListPrice(copy.id, copy.game.title)} className="flex items-center justify-center gap-2 rounded-xl border border-amber-700 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950">
                                <DollarSign className="h-4 w-4" />
                                Price
                              </button>
                              <button type="button" onClick={() => removeFromSellList(copy.id, copy.game.title)} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                                <Tag className="h-4 w-4" />
                                Unlist
                              </button>
                              <div className="rounded-xl border border-green-800 bg-green-950/30 px-3 py-2 text-center text-sm text-green-300">
                                Listed for sale
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => addGameCopyToSellList(copy)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-700 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950">
                              <Tag className="h-4 w-4" />
                              Add to Sell List
                            </button>
                          )}
                        </div>
                      )}
                      {canEdit && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => editCopy(copy)} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Edit</button><button type="button" onClick={() => deleteCopy(copy.id)} className="flex items-center justify-center gap-2 rounded-xl border border-red-800 px-3 py-2 text-sm text-red-300 hover:bg-red-950"><Trash2 className="h-4 w-4" />Delete</button></div>}
                    </div>
                  );
                })}
              </div>
              {sortedCopies(collection?.copies || []).length === 0 && <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">No games in this collection yet.</p>}
            </Card>
          ) : (
            <Card>
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h3 className="text-lg font-semibold">{collectionTypeLabel(collection?.type)}</h3>
                <label className="block md:w-64">
                  <span className="mb-1 block text-sm font-medium">Sort</span>
                  <select className="vgc-select" style={{ colorScheme: "light" }} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                    <option value="title-asc">Name A-Z</option>
                    <option value="title-desc">Name Z-A</option>
                    <option value="value-high">Current value high-low</option>
                    <option value="value-low">Current value low-high</option>
                    <option value="price-high">Price paid high-low</option>
                    <option value="price-low">Price paid low-high</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {sortedItems(collection?.items || []).map((item) => {
                  const delta = deltaLabel(item.estimatedValue, item.purchasePrice);
                  return (
                    <div key={item.id} className="vgc-surface rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
                      <div className="flex items-start gap-3">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-20 w-20 rounded object-cover" /> : collectionIcon(collection?.type)}<div><h4 className="font-semibold">{item.name}</h4><p className="vgc-muted text-sm text-zinc-400">{itemNoun(collection?.type)} · {conditionLabel(item.condition)}</p>{item.platform && <p className="vgc-muted text-xs text-zinc-400">{item.platform}</p>}</div></div>
                      <div className="vgc-muted mt-3 space-y-1 text-sm text-zinc-400">{item.maker && <p>Maker: {item.maker}</p>}{item.modelNumber && <p>Model: {item.modelNumber}</p>}{item.serialNumber && <p>Serial: {item.serialNumber}</p>}{item.barcode && <p>Barcode: {item.barcode}</p>}</div>
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm"><p>Price Paid: {item.purchasePrice ? money(item.purchasePrice) : "—"}</p><p>Current Value: {item.estimatedValue ? money(item.estimatedValue) : "—"}</p>{delta && <p className={delta.className}>Change: {delta.text}</p>}</div>
                      {item.notes && <p className="vgc-muted mt-2 text-sm text-zinc-400">{item.notes}</p>}
                      {collection?.type && <AssetPanel assetTag={item.assetTag} collectionItemId={item.id} collectionType={collection.type} canEdit={canEdit} user={user} branding={branding} onChanged={load} />}
                      {canEdit && (
                        <div className="mt-3 space-y-2">
                          {sellListBySourceId[item.id] ? (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <button type="button" onClick={() => updateSellListPrice(item.id, item.name)} className="flex items-center justify-center gap-2 rounded-xl border border-amber-700 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950">
                                <DollarSign className="h-4 w-4" />
                                Price
                              </button>
                              <button type="button" onClick={() => removeFromSellList(item.id, item.name)} className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                                <Tag className="h-4 w-4" />
                                Unlist
                              </button>
                              <div className="rounded-xl border border-green-800 bg-green-950/30 px-3 py-2 text-center text-sm text-green-300">
                                Listed for sale
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => addCollectionItemToSellList(item)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-700 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950">
                              <Tag className="h-4 w-4" />
                              Add to Sell List
                            </button>
                          )}
                        </div>
                      )}
                      {canEdit && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => editItem(item)} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Edit</button><button type="button" onClick={() => deleteItem(item.id)} className="flex items-center justify-center gap-2 rounded-xl border border-red-800 px-3 py-2 text-sm text-red-300 hover:bg-red-950"><Trash2 className="h-4 w-4" />Delete</button></div>}
                    </div>
                  );
                })}
              </div>
              {(!collection?.items || collection.items.length === 0) && <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">No {collectionTypeLabel(collection?.type).toLowerCase()} in this collection yet.</p>}
            </Card>
          )}
        </section>
      </div>

      {showCollectionModal && <Modal title="Edit Collection" onClose={() => setShowCollectionModal(false)}><form onSubmit={saveCollection} className="space-y-3"><Input placeholder="Collection name" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} /><textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Description" value={collectionDescription} onChange={(e) => setCollectionDescription(e.target.value)} rows={5} /><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="mb-2 text-sm font-semibold">Collection image</div>{collectionImageUrl && <img src={publicAssetUrl(collectionImageUrl)} alt="" className="mb-3 h-32 w-full rounded-xl border border-zinc-800 object-cover" />}<Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setCollectionImageFile(e.target.files?.[0] || null)} /><Input className="mt-2" placeholder="Image URL" value={collectionImageUrl} onChange={(e) => setCollectionImageUrl(e.target.value)} />{collectionImageFile && <p className="vgc-muted mt-2 text-xs text-zinc-400">Selected: {collectionImageFile.name}</p>}<button type="button" className="mt-2 text-xs text-red-300 hover:underline" onClick={() => { setCollectionImageUrl(""); setCollectionImageFile(null); }}>Remove collection image</button></div><select className="vgc-select" style={{ colorScheme: "light" }} value={collectionType} onChange={(e) => setCollectionType(e.target.value as CollectionType)}>{collectionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><p className="vgc-muted text-xs text-zinc-400">Changing collection type does not delete existing data, but the page only shows fields for the selected type.</p><div className="flex justify-between gap-2"><Button type="submit" disabled={isUploadingCollectionImage}>{isUploadingCollectionImage ? "Uploading..." : "Save collection"}</Button>{canDeleteCollection && <button type="button" onClick={deleteCollection} className="rounded-xl border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950">Delete collection</button>}</div></form></Modal>}

      {showGameModal && (
        <Modal title={editingCopyId ? "Edit Game" : "Add Game"} onClose={() => { setShowGameModal(false); resetGameForm(); }}>
          <form onSubmit={saveGame} className="space-y-3">
            <Input placeholder="Game title" value={title} onChange={(e) => setTitle(e.target.value)} /><Input placeholder="Release year" value={releaseYear} onChange={(e) => setReleaseYear(e.target.value)} /><Input placeholder="Cover URL" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
            <textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            <select className="vgc-select" style={{ colorScheme: "light" }} value={platformId} onChange={(e) => setPlatformId(e.target.value)} disabled={newPlatformName.trim().length > 0}><option value="">No platform</option>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select>
            <Input placeholder="Or create new platform" value={newPlatformName} onChange={(e) => setNewPlatformName(e.target.value)} />
            <select className="vgc-select" style={{ colorScheme: "light" }} value={format} onChange={(e) => setFormat(e.target.value as "PHYSICAL" | "DIGITAL")}><option value="PHYSICAL">Physical</option><option value="DIGITAL">Digital</option></select>
            <Input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} /><Input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} /><Input placeholder="Edition" value={edition} onChange={(e) => setEdition(e.target.value)} />
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input placeholder="Price Paid" value={pricePaid} onChange={(e) => setPricePaid(e.target.value)} /><Input placeholder="Current Value" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} /><Button type="button" onClick={lookupPriceChartingForGame}>Autofill</Button></div>
            <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-blue-100">PriceCharting product match</div>
                  <p className="mt-1 text-xs text-zinc-400">Match the exact PriceCharting product then use Autofill to update the price.</p><p className="mt-2 text-xs text-amber-200">Note: PriceCharting API access to CIB, New/Sealed, Box Only, Manual Only, and other non-loose values may require PriceCharting Legendary tier. Lower tiers may only return loose pricing even when the public PriceCharting page shows additional values.</p>
                </div>
                <Button type="button" onClick={searchPriceChartingProducts} disabled={isPriceChartingSearching}>{isPriceChartingSearching ? "Searching..." : "Search PriceCharting"}</Button>
              </div>
              {priceChartingProductId && <div className="mt-3 rounded-lg border border-blue-800 bg-blue-950/40 p-2 text-xs text-blue-100">Selected: {priceChartingProductName || "PriceCharting product"}{priceChartingConsoleName ? ` (${priceChartingConsoleName})` : ""}</div>}
              {priceChartingMatches.length > 0 && <div className="mt-3 space-y-2">{priceChartingMatches.map((match) => <button key={match.id} type="button" onClick={() => selectPriceChartingMatch(match)} className={`w-full rounded-xl border px-3 py-2 text-left text-sm hover:bg-blue-950 ${priceChartingProductId === match.id ? "border-blue-500 bg-blue-950/60" : "border-zinc-800 bg-zinc-950"}`}><div className="font-semibold">{match.productName} <span className="text-zinc-400">({match.consoleName})</span></div><div className="mt-1 text-xs text-zinc-400">{selectedPriceChartingProduct?.id === match.id ? <>Loose {selectedPriceChartingProduct.prices.loose ? money(selectedPriceChartingProduct.prices.loose) : "—"} · CIB {selectedPriceChartingProduct.prices.cib ? money(selectedPriceChartingProduct.prices.cib) : "—"} · New {selectedPriceChartingProduct.prices.new ? money(selectedPriceChartingProduct.prices.new) : "—"} · Box {selectedPriceChartingProduct.prices.box ? money(selectedPriceChartingProduct.prices.box) : "—"} · Manual {selectedPriceChartingProduct.prices.manual ? money(selectedPriceChartingProduct.prices.manual) : "—"}</> : "Select this product to load condition prices"}</div></button>)}</div>}
            </div>
            {format === "PHYSICAL" && (
              <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-3 text-sm">
                <div className="font-semibold text-blue-100">PriceCharting condition: {priceChartingConditionLabel()}</div>
                <p className="mt-1 text-xs text-zinc-400">Autofill uses the selected components below: game only = loose, game + box + manual = CIB, box only = box-only, manual only = manual-only, and New / Sealed = new/sealed. After the first autofill, changing these options refreshes the value automatically.</p>
              </div>
            )}
            {duplicateMatches.length > 0 && !editingCopyId && <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100"><div className="font-semibold">Possible duplicate already in this collection</div>{duplicateMatches.slice(0, 4).map((match) => <div key={`${match.type}-${match.id}`} className="mt-1">{match.title}{match.platform ? ` · ${match.platform}` : ""}{match.assetTag?.tag ? ` · ${match.assetTag.tag}` : ""} <span className="text-amber-300">({match.reason})</span></div>)}</div>}
            {format === "PHYSICAL" && <div className="rounded-xl border border-zinc-800 p-4"><h3 className="mb-1 font-semibold">Physical parts included</h3><p className="mb-3 text-xs text-zinc-400">These options are aligned to PriceCharting conditions where possible.</p><div className="space-y-3">{partDrafts.map((part) => <div key={part.type} className="vgc-surface rounded-xl border border-zinc-800 bg-zinc-950 p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={part.enabled} onChange={(e) => updatePart(part.type, { enabled: e.target.checked })} />{partLabel(part.type)}</label>{part.enabled && <div className="mt-3 grid gap-2 md:grid-cols-2"><select className="vgc-select" style={{ colorScheme: "light" }} value={part.condition} onChange={(e) => updatePart(part.type, { condition: e.target.value as ConditionGrade })}>{conditionOptions.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}</select><Input placeholder="Part notes" value={part.notes} onChange={(e) => updatePart(part.type, { notes: e.target.value })} /></div>}</div>)}</div></div>}
            <div className="grid grid-cols-2 gap-2"><Button type="submit">{editingCopyId ? "Save changes" : "Add game"}</Button><Button type="button" onClick={() => { setShowGameModal(false); resetGameForm(); }}>Cancel</Button></div>
          </form>
        </Modal>
      )}

      {showItemModal && (
        <Modal title={editingItemId ? `Edit ${itemNoun(collection?.type)}` : `Add ${itemNoun(collection?.type)}`} onClose={() => { setShowItemModal(false); resetItemForm(); }}>
          <form onSubmit={saveItem} className="space-y-3">
            <Input placeholder={`${itemNoun(collection?.type)} name`} value={itemName} onChange={(e) => setItemName(e.target.value)} />
            <Input placeholder="Maker, e.g. Nintendo, Sony, Microsoft, PDP" value={itemMaker} onChange={(e) => setItemMaker(e.target.value)} />
            <Input placeholder="Platform, e.g. Nintendo Switch, PS5, Xbox Series X" value={itemPlatform} onChange={(e) => setItemPlatform(e.target.value)} />
            <Input placeholder="Model number" value={itemModelNumber} onChange={(e) => setItemModelNumber(e.target.value)} />
            <Input placeholder="Serial number" value={itemSerialNumber} onChange={(e) => setItemSerialNumber(e.target.value)} />
            <Input placeholder="Barcode" value={itemBarcode} onChange={(e) => setItemBarcode(e.target.value)} />
            <select className="vgc-select" style={{ colorScheme: "light" }} value={itemCondition} onChange={(e) => setItemCondition(e.target.value as ConditionGrade)}>{conditionOptions.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}</select>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><Input placeholder="Price Paid" value={itemPricePaid} onChange={(e) => setItemPricePaid(e.target.value)} /><Input placeholder="Current Value" value={itemCurrentValue} onChange={(e) => setItemCurrentValue(e.target.value)} /><Button type="button" onClick={lookupPriceChartingForItem}>Autofill</Button></div>
            <Input placeholder="Image URL" value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} />
            <textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Notes" value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} rows={4} />
            {duplicateMatches.length > 0 && !editingItemId && <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-3 text-sm text-amber-100"><div className="font-semibold">Possible duplicate already in this collection</div>{duplicateMatches.slice(0, 4).map((match) => <div key={`${match.type}-${match.id}`} className="mt-1">{match.title}{match.platform ? ` · ${match.platform}` : ""}{match.assetTag?.tag ? ` · ${match.assetTag.tag}` : ""} <span className="text-amber-300">({match.reason})</span></div>)}</div>}
            <div className="grid grid-cols-2 gap-2"><Button type="submit">{editingItemId ? "Save changes" : `Add ${itemNoun(collection?.type)}`}</Button><Button type="button" onClick={() => { setShowItemModal(false); resetItemForm(); }}>Cancel</Button></div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
