-- Add a dedicated part type for sealed/new copies.
ALTER TYPE "GamePartType" ADD VALUE IF NOT EXISTS 'SEALED';
