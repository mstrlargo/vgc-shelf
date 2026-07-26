export type Branding = {
  appName: string;
  pageTitle: string;
  appIconUrl?: string | null;
  faviconUrl?: string | null;
  assetTagPrefix?: string | null;
  labelText?: string | null;
  assetLabelWidth?: number | null;
  assetLabelHeight?: number | null;
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
  allowPublicSignup?: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DEFAULT_ICON_URL = "/vgcs-icon.png";

export function normalizeIconUrl(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : DEFAULT_ICON_URL;
}

export function resolvedAppIconUrl(branding?: Partial<Branding> | null) {
  return normalizeIconUrl(branding?.appIconUrl);
}

export function resolvedFaviconUrl(branding?: Partial<Branding> | null) {
  return normalizeIconUrl(branding?.faviconUrl || branding?.appIconUrl);
}

export function applyBranding(branding: Branding) {
  if (typeof document === "undefined") return;

  const normalizedBranding: Branding = {
    ...branding,
    appName: branding.appName || "VGC Shelf",
    pageTitle: branding.pageTitle || branding.appName || "VGC Shelf",
    appIconUrl: normalizeIconUrl(branding.appIconUrl),
    faviconUrl: normalizeIconUrl(branding.faviconUrl || branding.appIconUrl),
    assetTagPrefix: branding.assetTagPrefix || "VGC",
    labelText: branding.labelText || "",
    assetLabelWidth: Number(branding.assetLabelWidth) || 2.25,
    assetLabelHeight: Number(branding.assetLabelHeight) || 1.0,
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

  document.title = normalizedBranding.pageTitle;

  const faviconUrl = resolvedFaviconUrl(normalizedBranding);
  const cacheBustedUrl = `${faviconUrl}${faviconUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;

  const existingIcons = Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    )
  );

  for (const icon of existingIcons) {
    icon.remove();
  }

  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.href = cacheBustedUrl;
  document.head.appendChild(icon);

  const shortcut = document.createElement("link");
  shortcut.rel = "shortcut icon";
  shortcut.href = cacheBustedUrl;
  document.head.appendChild(shortcut);

  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = cacheBustedUrl;
  document.head.appendChild(apple);

  window.dispatchEvent(
    new CustomEvent<Branding>("vgc-branding-updated", {
      detail: normalizedBranding
    })
  );
}

export async function loadBranding(): Promise<Branding> {
  try {
    const res = await fetch(`${API_URL}/branding`, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error("Failed to load branding");
    }

    const data = await res.json();
    const branding = data.branding || data;

    return {
      appName: branding.appName || "VGC Shelf",
      pageTitle: branding.pageTitle || branding.appName || "VGC Shelf",
      appIconUrl: normalizeIconUrl(branding.appIconUrl),
      faviconUrl: normalizeIconUrl(branding.faviconUrl || branding.appIconUrl),
      assetTagPrefix: branding.assetTagPrefix || "VGC",
      labelText: branding.labelText || "",
      assetLabelWidth: Number(branding.assetLabelWidth) || 2.25,
      assetLabelHeight: Number(branding.assetLabelHeight) || 1.0,
      assetLabelShowQr: branding.assetLabelShowQr ?? true,
      assetLabelShowLabelText: branding.assetLabelShowLabelText ?? true,
      assetLabelShowAssetTag: branding.assetLabelShowAssetTag ?? true,
      assetLabelShowItemTitle: branding.assetLabelShowItemTitle ?? false,
      assetLabelShowCollectionName: branding.assetLabelShowCollectionName ?? false,
      assetLabelShowPlatform: branding.assetLabelShowPlatform ?? false,
      assetLabelShowCollectionType: branding.assetLabelShowCollectionType ?? false,
      assetLabelShowOwnerName: branding.assetLabelShowOwnerName ?? true,
      assetLabelShowOwnerEmail: branding.assetLabelShowOwnerEmail ?? true,
      assetLabelShowBarcode: branding.assetLabelShowBarcode ?? false,
      allowPublicSignup: data.allowPublicSignup ?? data.settings?.allowPublicSignup
    };
  } catch {
    return {
      appName: "VGC Shelf",
      pageTitle: "VGC Shelf",
      appIconUrl: DEFAULT_ICON_URL,
      faviconUrl: DEFAULT_ICON_URL,
      assetTagPrefix: "VGC",
      labelText: "",
      assetLabelWidth: 2.25,
      assetLabelHeight: 1.0,
      assetLabelShowQr: true,
      assetLabelShowLabelText: true,
      assetLabelShowAssetTag: true,
      assetLabelShowItemTitle: false,
      assetLabelShowCollectionName: false,
      assetLabelShowPlatform: false,
      assetLabelShowCollectionType: false,
      assetLabelShowOwnerName: true,
      assetLabelShowOwnerEmail: true,
      assetLabelShowBarcode: false
    };
  }
}

export function defaultIconUrl() {
  return DEFAULT_ICON_URL;
}
