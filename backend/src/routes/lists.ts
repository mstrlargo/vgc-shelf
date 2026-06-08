import { Router } from "express";
import { requireAuth } from "../auth.js";
import { registerWishlistRoutes } from "./wishlist.js";
import { registerSellListRoutes } from "./sellList.js";

const router = Router();

router.use(requireAuth);
registerWishlistRoutes(router);
registerSellListRoutes(router);

export default router;
