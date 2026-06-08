import type {Request,Response,NextFunction} from "express";
import { ZodError } from "zod";
export function notFound(_req:Request,res:Response){ res.status(404).json({error:"Not found"}); }
export function errorHandler(err:unknown,_req:Request,res:Response,_next:NextFunction){ console.error(err); if(err instanceof ZodError) return res.status(400).json({error:"Validation error",details:err.flatten()}); return res.status(500).json({error:"Internal server error"}); }
