"use client";

import { AssetTagLite, User } from "@/lib/api";
import { Branding } from "@/lib/branding";

export type AssetLabelDetails = {
  itemTitle?: string | null;
  collectionName?: string | null;
  platform?: string | null;
  collectionType?: string | null;
  barcode?: string | null;
};

type LabelLineKind = "heading" | "tag" | "primary" | "secondary" | "code";

type LabelLine = {
  kind: LabelLineKind;
  value: string;
};

export function qrUrlForTag(tag: string) {
  if (typeof window === "undefined") return "";

  const url = `${window.location.origin}/assets/${encodeURIComponent(tag)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelTextFor(branding: Branding) {
  return branding.labelText?.trim() || branding.appName?.trim() || "VGC Shelf";
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function labelLayout(branding: Branding, rowCount: number) {
  const width = clamp(Number(branding.assetLabelWidth) || 2.25, 0.5, 6);
  const height = clamp(Number(branding.assetLabelHeight) || 1, 0.5, 6);
  const padding = clamp(height * 0.055, 0.04, 0.1);
  const gap = clamp(height * 0.06, 0.045, 0.1);
  const qrSize = Math.max(0.35, height - padding * 2);
  const rowScale = clamp(4 / Math.max(4, rowCount), 0.55, 1);
  const scale = clamp((qrSize / 0.62) * rowScale, 0.65, 2.5);

  return {
    width,
    height,
    padding,
    gap,
    qrSize,
    appFontSize: 9 * scale,
    tagFontSize: 12 * scale,
    primaryFontSize: 8.5 * scale,
    secondaryFontSize: 7.5 * scale,
    codeFontSize: 7.5 * scale,
    rowGap: clamp((qrSize * 0.025) * rowScale, 0.005, 0.04)
  };
}

function readableType(value?: string | null) {
  if (!value) return "";

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inferredDetails(assetTag: AssetTagLite): AssetLabelDetails {
  const asset = assetTag as any;
  const gameCopy = asset.gameCopy;
  const collectionItem = asset.collectionItem;
  const collection = gameCopy?.collection || collectionItem?.collection;

  return {
    itemTitle: gameCopy?.game?.title || collectionItem?.name || "",
    collectionName: collection?.name || "",
    platform: gameCopy?.game?.platform?.name || collectionItem?.platform || "",
    collectionType: readableType(collection?.type || collectionItem?.category),
    barcode: gameCopy?.barcode || collectionItem?.barcode || ""
  };
}

function labelContent(
  assetTag: AssetTagLite,
  user: User | null,
  branding: Branding,
  details?: AssetLabelDetails
) {
  const resolved = { ...inferredDetails(assetTag), ...details };
  const lines: LabelLine[] = [];

  if (branding.assetLabelShowLabelText ?? true) {
    lines.push({ kind: "heading", value: labelTextFor(branding) });
  }

  if (branding.assetLabelShowAssetTag ?? true) {
    lines.push({ kind: "tag", value: assetTag.tag });
  }

  if ((branding.assetLabelShowItemTitle ?? false) && resolved.itemTitle) {
    lines.push({ kind: "primary", value: resolved.itemTitle });
  }

  if ((branding.assetLabelShowCollectionName ?? false) && resolved.collectionName) {
    lines.push({ kind: "secondary", value: resolved.collectionName });
  }

  if ((branding.assetLabelShowPlatform ?? false) && resolved.platform) {
    lines.push({ kind: "secondary", value: resolved.platform });
  }

  if ((branding.assetLabelShowCollectionType ?? false) && resolved.collectionType) {
    lines.push({ kind: "secondary", value: readableType(resolved.collectionType) });
  }

  if (branding.assetLabelShowOwnerName ?? true) {
    lines.push({ kind: "primary", value: user?.name || user?.email || "Owner" });
  }

  if ((branding.assetLabelShowOwnerEmail ?? true) && user?.email) {
    lines.push({ kind: "secondary", value: user.email });
  }

  if ((branding.assetLabelShowBarcode ?? false) && resolved.barcode) {
    lines.push({ kind: "code", value: resolved.barcode });
  }

  return {
    showQr: branding.assetLabelShowQr ?? true,
    lines
  };
}

function labelMarkup(assetTag: AssetTagLite, content: ReturnType<typeof labelContent>) {
  return `
    <div class="label">
      ${content.showQr ? `<img class="qr" src="${qrUrlForTag(assetTag.tag)}" alt="QR code" />` : ""}
      <div class="text">
        ${content.lines.map((line) => `<div class="line ${line.kind}">${escapeHtml(line.value)}</div>`).join("")}
      </div>
    </div>
  `;
}

export function printAssetLabels({
  assetTags,
  user,
  branding,
  detailsByTag
}: {
  assetTags: AssetTagLite[];
  user: User | null;
  branding: Branding;
  detailsByTag?: Record<string, AssetLabelDetails>;
}) {
  if (typeof window === "undefined" || assetTags.length === 0) return false;

  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    window.print();
    return false;
  }

  const title = assetTags.length === 1 ? assetTags[0].tag : `${assetTags.length} asset labels`;
  const contents = assetTags.map((assetTag) =>
    labelContent(assetTag, user, branding, detailsByTag?.[assetTag.tag])
  );
  const layout = labelLayout(
    branding,
    Math.max(0, ...contents.map((content) => content.lines.length))
  );

  printWindow.document.open();
  printWindow.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${layout.width}in ${layout.height}in;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: Arial, Helvetica, sans-serif;
    }

    .label {
      box-sizing: border-box;
      width: ${layout.width}in;
      height: ${layout.height}in;
      padding: ${layout.padding}in;
      display: flex;
      align-items: center;
      gap: ${layout.gap}in;
      overflow: hidden;
      border: 1px solid #ddd;
      break-after: page;
      page-break-after: always;
    }

    .label:last-child {
      break-after: auto;
      page-break-after: auto;
    }

    .qr {
      width: ${layout.qrSize}in;
      height: ${layout.qrSize}in;
      flex: 0 0 auto;
    }

    .text {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      height: ${layout.qrSize}in;
      overflow: hidden;
      line-height: 1.1;
    }

    .line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .line + .line {
      margin-top: ${layout.rowGap}in;
    }

    .heading {
      font-size: ${layout.appFontSize}px;
      font-weight: 700;
    }

    .tag {
      font-family: "Courier New", monospace;
      font-size: ${layout.tagFontSize}px;
      font-weight: 700;
    }

    .primary {
      font-size: ${layout.primaryFontSize}px;
      font-weight: 700;
    }

    .secondary {
      font-size: ${layout.secondaryFontSize}px;
    }

    .code {
      font-family: "Courier New", monospace;
      font-size: ${layout.codeFontSize}px;
    }

    @media screen {
      body {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px;
      }

      .label {
        break-after: auto;
        page-break-after: auto;
      }
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${assetTags.map((assetTag, index) => labelMarkup(assetTag, contents[index])).join("\n")}
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `);
  printWindow.document.close();
  return true;
}

export function printAssetLabel({
  assetTag,
  user,
  branding,
  details
}: {
  assetTag: AssetTagLite;
  user: User | null;
  branding: Branding;
  details?: AssetLabelDetails;
}) {
  return printAssetLabels({
    assetTags: [assetTag],
    user,
    branding,
    detailsByTag: details ? { [assetTag.tag]: details } : undefined
  });
}

export function SmallAssetLabel({
  assetTag,
  user,
  branding,
  details
}: {
  assetTag: AssetTagLite;
  user: User | null;
  branding: Branding;
  details?: AssetLabelDetails;
}) {
  const content = labelContent(assetTag, user, branding, details);
  const layout = labelLayout(branding, content.lines.length);
  const previewWidth = 288;
  const previewScale = previewWidth / (layout.width * 96);
  const previewHeight = previewWidth * (layout.height / layout.width);

  return (
    <div
      className="print-label flex items-center overflow-hidden rounded border border-zinc-300 bg-white text-zinc-950"
      style={{
        width: "100%",
        maxWidth: previewWidth,
        height: previewHeight,
        padding: layout.padding * 96 * previewScale,
        gap: layout.gap * 96 * previewScale
      }}
    >
      {content.showQr && (
        <img
          src={qrUrlForTag(assetTag.tag)}
          alt={`QR ${assetTag.tag}`}
          className="shrink-0"
          style={{
            width: layout.qrSize * 96 * previewScale,
            height: layout.qrSize * 96 * previewScale
          }}
        />
      )}
      <div
        className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden leading-[1.1]"
        style={{ height: layout.qrSize * 96 * previewScale }}
      >
        {content.lines.map((line, index) => {
          const fontSize =
            line.kind === "heading"
              ? layout.appFontSize
              : line.kind === "tag"
                ? layout.tagFontSize
                : line.kind === "primary"
                  ? layout.primaryFontSize
                  : line.kind === "code"
                    ? layout.codeFontSize
                    : layout.secondaryFontSize;

          return (
            <div
              key={`${line.kind}-${index}`}
              className={`truncate ${
                line.kind === "tag" || line.kind === "code" ? "font-mono" : ""
              } ${
                line.kind === "heading" || line.kind === "tag" || line.kind === "primary"
                  ? "font-bold"
                  : ""
              }`}
              style={{
                marginTop: index === 0 ? 0 : layout.rowGap * 96 * previewScale,
                fontSize: fontSize * previewScale
              }}
            >
              {line.value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
