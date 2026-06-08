import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "node:path";
import { prisma } from "./db.js";
import { cache } from "./cache.js";
import { errorHandler, notFound } from "./errors.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import collectionRoutes from "./routes/collections.js";
import gameRoutes from "./routes/games.js";
import platformRoutes from "./routes/platforms.js";
import copyRoutes from "./routes/copies.js";
import statsRoutes from "./routes/stats.js";
import metadataRoutes from "./routes/metadata.js";
import brandingRoutes from "./routes/branding.js";
import itemRoutes from "./routes/items.js";
import priceChartingRoutes from "./routes/pricecharting.js";
import assetRoutes from "./routes/assets.js";
import uploadRoutes from "./routes/uploads.js";
import searchRoutes from "./routes/search.js";
import backupRoutes from "./routes/backup.js";
import reportsRoutes from "./routes/reports.js";
import dashboardDataRoutes from "./routes/dashboardData.js";
import listRoutes from "./routes/lists.js";
import duplicateRoutes from "./routes/duplicates.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const uploadDir = process.env.UPLOAD_DIR || "/app/uploads";

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: "12mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(uploadDir)));

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;

  let redis = "disabled";

  if (cache) {
    try {
      await cache.ping();
      redis = "connected";
    } catch {
      redis = "unavailable";
    }
  }

  res.json({ ok: true, database: "connected", redis });
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/collections", collectionRoutes);
app.use("/games", gameRoutes);
app.use("/platforms", platformRoutes);
app.use("/stats", statsRoutes);
app.use("/metadata", metadataRoutes);
app.use("/branding", brandingRoutes);
app.use("/metadata/pricecharting", priceChartingRoutes);
app.use("/assets", assetRoutes);
app.use("/uploads", uploadRoutes);
app.use("/search", searchRoutes);
app.use("/backup", backupRoutes);
app.use("/reports", reportsRoutes);
app.use("/dashboard-data", dashboardDataRoutes);
app.use("/lists", listRoutes);
app.use("/duplicates", duplicateRoutes);
app.use("/", copyRoutes);
app.use("/", itemRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`VGC Shelf backend listening on port ${port}`);
});
