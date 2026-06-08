import { Router } from "express"; import { z } from "zod"; import { prisma } from "../db.js"; import { requireAuth } from "../auth.js";
const router=Router();
router.get("/", requireAuth, async (_req,res,next)=>{ try{ const platforms=await prisma.platform.findMany({orderBy:{name:"asc"}}); res.json({platforms}); }catch(err){next(err);} });
router.post("/", requireAuth, async (req,res,next)=>{ try{ const body=z.object({name:z.string().min(1),maker:z.string().optional()}).parse(req.body); const platform=await prisma.platform.create({data:body}); res.status(201).json({platform}); }catch(err){next(err);} });
export default router;
