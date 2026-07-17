ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Loan_dueAt_status_idx" ON "Loan"("dueAt", "status");
CREATE INDEX IF NOT EXISTS "Loan_borrowerName_idx" ON "Loan"("borrowerName");
