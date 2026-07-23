import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";

const router = Router();

router.use(requireAuth);

const conditionSchema = z.enum(["loose", "cib", "new", "manual", "box", "graded"]);
type PriceCondition = z.infer<typeof conditionSchema>;

type PriceChartingProduct = Record<string, unknown> & {
  id?: string | number;
  "product-name"?: string;
  "console-name"?: string;
  status?: string;
};

function centsToDollars(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round((numeric / 100) * 100) / 100;
}

function priceKeyForCondition(condition: PriceCondition): string {
  switch (condition) {
    case "cib": return "cib-price";
    case "new": return "new-price";
    case "manual": return "manual-only-price";
    case "box": return "box-only-price";
    case "graded": return "graded-price";
    case "loose":
    default: return "loose-price";
  }
}

function conditionLabel(condition: PriceCondition): string {
  switch (condition) {
    case "cib": return "Complete in Box";
    case "new": return "New / Sealed";
    case "manual": return "Manual Only";
    case "box": return "Box Only";
    case "graded": return "Graded";
    case "loose":
    default: return "Loose";
  }
}

function productSummary(product: PriceChartingProduct) {
  const prices = {
    loose: centsToDollars(product["loose-price"]),
    cib: centsToDollars(product["cib-price"]),
    new: centsToDollars(product["new-price"]),
    manual: centsToDollars(product["manual-only-price"]),
    box: centsToDollars(product["box-only-price"]),
    graded: centsToDollars(product["graded-price"])
  };

  return {
    id: product.id ? String(product.id) : "",
    productName: String(product["product-name"] || ""),
    consoleName: String(product["console-name"] || ""),
    prices,
    availableConditions: Object.entries(prices)
      .filter(([, value]) => typeof value === "number" && value > 0)
      .map(([condition]) => condition),
    returnedPriceKeys: Object.keys(product).filter((key) => key.endsWith("-price"))
  };
}

async function getToken() {
  const settings = await prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", allowPublicSignup: true }
  });
  if (!settings.priceChartingApiKey) {
    const error = new Error("PriceCharting API key is not configured") as Error & { status?: number };
    error.status = 400;
    throw error;
  }
  return settings.priceChartingApiKey;
}

async function fetchPriceCharting(path: "/api/product" | "/api/products", token: string, params: Record<string, string>) {
  const url = new URL(`https://www.pricecharting.com${path}`);
  url.searchParams.set("t", token);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "VGC-Shelf/1.0" }
  });

  const data = await response.json().catch(() => null) as any;
  if (!response.ok || !data || data.status === "error") {
    const error = new Error(data?.["error-message"] || "PriceCharting lookup failed") as Error & { status?: number };
    error.status = response.status || 400;
    throw error;
  }
  return data;
}

async function fetchProductById(token: string, id: string | number): Promise<PriceChartingProduct> {
  return await fetchPriceCharting("/api/product", token, { id: String(id) }) as PriceChartingProduct;
}

async function fetchProductByUpc(token: string, upc: string): Promise<PriceChartingProduct> {
  return await fetchPriceCharting("/api/product", token, { upc }) as PriceChartingProduct;
}

async function searchProducts(token: string, q: string): Promise<PriceChartingProduct[]> {
  const data = await fetchPriceCharting("/api/products", token, { q });
  return Array.isArray(data.products) ? data.products : [];
}

router.get("/products", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
    const platform = typeof req.query.platform === "string" ? req.query.platform.trim() : "";
    const upc = typeof req.query.upc === "string" ? req.query.upc.trim() : "";
    const token = await getToken();

    let products: PriceChartingProduct[] = [];
    if (upc) {
      const product = await fetchProductByUpc(token, upc);
      products = product?.id ? [product] : [];
    } else {
      const search = q || [title, platform].filter(Boolean).join(" ").trim();
      if (!search) return res.status(400).json({ error: "Provide q, title/platform, or upc" });
      products = await searchProducts(token, search);
    }

    res.json({ products: products.slice(0, 20).filter((p) => p.id).map(productSummary) });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message || "PriceCharting lookup failed" });
    next(err);
  }
});


router.get("/product", async (req, res, next) => {
  try {
    const productId = typeof req.query.productId === "string" ? req.query.productId.trim() : "";
    const upc = typeof req.query.upc === "string" ? req.query.upc.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const token = await getToken();

    let product: PriceChartingProduct | null = null;
    if (productId) product = await fetchProductById(token, productId);
    else if (upc) product = await fetchProductByUpc(token, upc);
    else if (q) product = await fetchPriceCharting("/api/product", token, { q }) as PriceChartingProduct;
    else return res.status(400).json({ error: "Provide productId, q, or upc" });

    if (!product?.id) return res.status(404).json({ error: "No PriceCharting product match found" });
    res.json({ product: productSummary(product) });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message || "PriceCharting product lookup failed" });
    next(err);
  }
});

router.get("/value", async (req, res, next) => {
  try {
    const productId = typeof req.query.productId === "string" ? req.query.productId.trim() : "";
    const upc = typeof req.query.upc === "string" ? req.query.upc.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const title = typeof req.query.title === "string" ? req.query.title.trim() : "";
    const platform = typeof req.query.platform === "string" ? req.query.platform.trim() : "";
    const condition = conditionSchema.default("loose").parse(req.query.condition || "loose");
    const token = await getToken();

    let product: PriceChartingProduct | null = null;
    if (productId) {
      product = await fetchProductById(token, productId);
    } else if (upc) {
      product = await fetchProductByUpc(token, upc);
    } else {
      const search = q || [title, platform].filter(Boolean).join(" ").trim();
      if (!search) return res.status(400).json({ error: "Select a PriceCharting product or provide title/q/upc" });
      const data = await fetchPriceCharting("/api/product", token, { q: search }) as PriceChartingProduct;
      product = data?.id ? data : null;
    }

    if (!product?.id) return res.status(404).json({ error: "No PriceCharting product match found" });

    const priceKey = priceKeyForCondition(condition);
    const currentValue = centsToDollars(product[priceKey]);
    const summary = productSummary(product);

    if (!currentValue) {
      const available = Object.entries(summary.prices)
        .filter(([, value]) => typeof value === "number" && value > 0)
        .map(([availableCondition, value]) => ({
          condition: availableCondition,
          label: conditionLabel(availableCondition as PriceCondition),
          value
        }));

      return res.status(409).json({
        error: `PriceCharting matched ${summary.productName || "PriceCharting product"} (${summary.consoleName || "unknown console"}), but the API response did not include ${conditionLabel(condition)}. Enter the value manually or choose one of the API-returned conditions.`,
        result: {
          productId: summary.id,
          productName: summary.productName,
          consoleName: summary.consoleName,
          condition,
          conditionLabel: conditionLabel(condition),
          priceKey,
          availablePrices: available,
          returnedPriceKeys: summary.returnedPriceKeys
        },
        debug: { condition, priceKey, ...summary }
      });
    }

    res.json({
      result: {
        productId: summary.id,
        productName: summary.productName,
        consoleName: summary.consoleName,
        condition,
        conditionLabel: conditionLabel(condition),
        priceLabel: conditionLabel(condition),
        priceKey,
        currentValue,
        source: "PriceCharting",
        raw: summary.prices
      }
    });
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.message || "PriceCharting lookup failed" });
    next(err);
  }
});

export default router;
