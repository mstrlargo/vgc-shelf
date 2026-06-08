import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";

const router = Router();

router.use(requireAuth);

function centsToDollars(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round((value / 100) * 100) / 100;
}

function selectPrice(data: any, condition: string) {
  const normalized = condition.toLowerCase();

  if (normalized === "new") return data["new-price"];
  if (normalized === "cib") return data["cib-price"];
  if (normalized === "manual") return data["manual-only-price"];
  if (normalized === "box") return data["box-only-price"];
  if (normalized === "graded") return data["graded-price"];

  return data["loose-price"] || data["cib-price"] || data["new-price"] || data["used-price"];
}

router.get("/value", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const upc = typeof req.query.upc === "string" ? req.query.upc.trim() : "";
    const condition = z.enum(["loose", "cib", "new", "manual", "box", "graded"]).default("loose").parse(req.query.condition || "loose");

    if (!q && !upc) {
      return res.status(400).json({ error: "Provide q or upc" });
    }

    const settings = await prisma.appSetting.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global", allowPublicSignup: true }
    });

    if (!settings.priceChartingApiKey) {
      return res.status(400).json({ error: "PriceCharting API key is not configured" });
    }

    const url = new URL("https://www.pricecharting.com/api/product");
    url.searchParams.set("t", settings.priceChartingApiKey);

    if (upc) {
      url.searchParams.set("upc", upc);
    } else {
      url.searchParams.set("q", q);
    }

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "VGC-Shelf/1.0"
      }
    });

    const data = await response.json() as any;

    if (!response.ok || data.status === "error") {
      return res.status(response.status || 400).json({
        error: data["error-message"] || "PriceCharting lookup failed"
      });
    }

    const rawPrice = selectPrice(data, condition);
    const currentValue = centsToDollars(rawPrice);

    if (!currentValue) {
      return res.status(404).json({ error: "No matching current value found" });
    }

    res.json({
      result: {
        productId: data.id || null,
        productName: data["product-name"] || null,
        consoleName: data["console-name"] || null,
        condition,
        currentValue,
        source: "PriceCharting",
        raw: {
          loosePrice: centsToDollars(data["loose-price"]),
          cibPrice: centsToDollars(data["cib-price"]),
          newPrice: centsToDollars(data["new-price"]),
          manualOnlyPrice: centsToDollars(data["manual-only-price"]),
          boxOnlyPrice: centsToDollars(data["box-only-price"]),
          gradedPrice: centsToDollars(data["graded-price"])
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
