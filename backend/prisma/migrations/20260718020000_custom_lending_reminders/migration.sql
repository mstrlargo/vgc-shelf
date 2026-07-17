ALTER TABLE "AppSetting"
  ADD COLUMN IF NOT EXISTS "loanReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "loanReminderTiming" TEXT NOT NULL DEFAULT 'AFTER_DUE',
  ADD COLUMN IF NOT EXISTS "loanReminderDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "loanReminderRepeatDays" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "loanReminderSubject" TEXT NOT NULL DEFAULT 'Reminder: {{title}} is due {{dueDate}}',
  ADD COLUMN IF NOT EXISTS "loanReminderMessage" TEXT NOT NULL DEFAULT E'Hello {{borrowerName}},\n\nThis is a reminder that {{title}} ({{assetTag}}) from {{collectionName}} is due {{dueDate}}.\n\nPlease arrange to return it.\n\nThank you.';
