import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

const uploadDir = process.env.UPLOAD_DIR || "/app/uploads";
const publicBaseUrl = process.env.PUBLIC_UPLOAD_BASE_URL || "/uploads";

const schema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1)
});

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function ext(mime: string) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return "";
}

router.post("/image", async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    if (!allowed.has(body.mimeType)) return res.status(400).json({ error: "Unsupported image type" });

    const buffer = Buffer.from(body.dataBase64, "base64");
    if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: "Image is too large. Max size is 8 MB." });

    await fs.mkdir(uploadDir, { recursive: true });
    const base = body.filename.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 80) || "image";
    const storedName = `${base}-${crypto.randomUUID()}${ext(body.mimeType)}`;
    await fs.writeFile(path.join(uploadDir, storedName), buffer);

    res.status(201).json({ url: `${publicBaseUrl}/${storedName}`, filename: storedName });
  } catch (err) {
    next(err);
  }
});

export default router;
