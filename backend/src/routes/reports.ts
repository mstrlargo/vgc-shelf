import { Router } from "express";
import { requireAuth } from "../auth.js";

import { analyticsFor, duplicateGroups, loadData, metadataReport } from "./reportHelpers.js";

const router = Router();
router.use(requireAuth);


router.get("/summary", async (req, res, next) => {
  try {
    const data = await loadData(req.user!.id);
    res.json({ analytics: analyticsFor(data) });
  } catch (err) {
    next(err);
  }
});

router.get("/duplicates", async (req, res, next) => {
  try {
    const data = await loadData(req.user!.id);
    res.json({ duplicateGroups: duplicateGroups(data) });
  } catch (err) {
    next(err);
  }
});

router.get("/metadata", async (req, res, next) => {
  try {
    const data = await loadData(req.user!.id);
    res.json({ metadata: metadataReport(data) });
  } catch (err) {
    next(err);
  }
});

router.get("/analytics", async (req, res, next) => {
  try {
    const data = await loadData(req.user!.id);
    res.json({ analytics: analyticsFor(data) });
  } catch (err) {
    next(err);
  }
});

export default router;
