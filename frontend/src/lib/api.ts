export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type User = {
  id: string;
  email: string;
  name?: string | null;
  role?: "ADMIN" | "USER";
};

export type Platform = {
  id: string;
  name: string;
  maker?: string | null;
};

export type Game = {
  id: string;
  title: string;
  description?: string | null;
  releaseYear?: number | null;
  coverUrl?: string | null;
  platform?: Platform | null;
};

export type MetadataResult = {
  provider: string;
  externalId: string;
  title: string;
  description?: string | null;
  releaseYear?: number | null;
  coverUrl?: string | null;
  platformName?: string | null;
  sourceUrl?: string | null;
  barcode?: string | null;
};

export type CollectionType = "GAMES" | "SYSTEMS" | "PERIPHERALS" | "TOYS_TO_LIFE";

export type Loan = {
  id: string;
  assetTagId: string;
  checkedOutByUserId: string;
  borrowerName: string;
  borrowerEmail?: string | null;
  checkedOutAt: string;
  dueAt?: string | null;
  returnedAt?: string | null;
  status: "CHECKED_OUT" | "RETURNED";
  checkoutNotes?: string | null;
  returnNotes?: string | null;
  checkedOutBy?: Pick<User, "id" | "email" | "name">;
};

export type AssetTagLite = {
  id: string;
  tag: string;
  gameCopyId?: string | null;
  collectionItemId?: string | null;
  notes?: string | null;
  loans: Loan[];
};

export type CollectionItem = {
  id: string;
  collectionId: string;
  category: "SYSTEM" | "PERIPHERAL" | "TOYS_TO_LIFE" | "OTHER";
  name: string;
  maker?: string | null;
  platform?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  barcode?: string | null;
  condition: string;
  purchasePrice?: string | null;
  estimatedValue?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  assetTag?: AssetTagLite | null;
};

export type CollectionMember = {
  id: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  userId: string;
  collectionId: string;
  user: User;
};

export type Collection = {
  id: string;
  name: string;
  description?: string | null;
  type: CollectionType;
  imageUrl?: string | null;
  role?: "OWNER" | "EDITOR" | "VIEWER";
  _count?: {
    copies: number;
    members: number;
    items?: number;
  };
  members?: CollectionMember[];
  copies?: GameCopy[];
  items?: CollectionItem[];
};

export type DuplicateItem = {
  id: string;
  type: "GAME_COPY" | "COLLECTION_ITEM";
  title: string;
  platform?: string | null;
  barcode?: string | null;
  format?: string | null;
  reason: string;
  assetTag?: { tag: string } | null;
};

export type DuplicateGroup = {
  key: string;
  reason: string;
  items: DuplicateItem[];
};

export type GameCopy = {
  id: string;
  game: Game;
  format: "PHYSICAL" | "DIGITAL";
  barcode?: string | null;
  region?: string | null;
  edition?: string | null;
  purchasePrice?: string | null;
  estimatedValue?: string | null;
  notes?: string | null;
  assetTag?: AssetTagLite | null;
  parts: Array<{
    id: string;
    type: string;
    condition: string;
    notes?: string | null;
  }>;
};

export type DashboardStats = {
  collections: number;
  copies: number;
  uniqueGames: number;
  platforms: number;
  physicalCopies: number;
  digitalCopies: number;
  inventoryItems?: number;
  systems?: number;
  peripherals?: number;
  toysToLife?: number;
  estimatedValue: number;
  purchasePrice?: number;
  valueDelta?: number;
  conditionCounts: Array<{
    condition: string;
    count: number;
  }>;
  platformCounts: Array<{
    platform: string;
    copies: number;
  }>;
};

const TOKEN_KEY = "vgc_token";
const LEGACY_TOKEN_KEY = "token";

export function publicAssetUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return `${API_URL}${url}`;
  return url;
}

export function getToken() {
  if (typeof window === "undefined") return "";

  const token = localStorage.getItem(TOKEN_KEY);

  if (token) return token;

  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);

  if (legacyToken) {
    localStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    return legacyToken;
  }

  return "";
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function saveToken(token: string) {
  setToken(token);
}

export function clearToken() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/") {
    window.location.href = "/";
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    redirectToLogin();
    throw new Error("Please sign in again.");
  }

  if (!res.ok) {
    let error = "API request failed";
    try {
      const body = await res.json();
      error = body.error || error;
    } catch {}
    throw new Error(error);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export async function login(email: string, password: string) {
  return api<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function register(email: string, password: string, name?: string) {
  return api<{ token: string; user: User }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name })
  });
}
