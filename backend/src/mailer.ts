import nodemailer from "nodemailer";
import { prisma } from "./db.js";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
};

type ReminderTiming = "BEFORE_DUE" | "ON_DUE" | "AFTER_DUE";

type ReminderConfig = {
  enabled: boolean;
  timing: ReminderTiming;
  days: number;
  repeatDays: number;
  subject: string;
  message: string;
};

const DEFAULT_SUBJECT = "Reminder: {{title}} is due {{dueDate}}";
const DEFAULT_MESSAGE = "Hello {{borrowerName}},\n\nThis is a reminder that {{title}} ({{assetTag}}) from {{collectionName}} is due {{dueDate}}.\n\nPlease arrange to return it.\n\nThank you.";

async function smtpConfig(): Promise<SmtpConfig | null> {
  const settings = await prisma.appSetting.findUnique({ where: { id: "global" } });
  const raw = settings as any;

  const databaseConfigured = Boolean(raw?.smtpHost && raw?.smtpFrom);
  const host = String(databaseConfigured ? raw.smtpHost : process.env.SMTP_HOST || "").trim();
  const from = String(databaseConfigured ? raw.smtpFrom : process.env.SMTP_FROM || "").trim();
  if (!host || !from) return null;

  const user = String(databaseConfigured ? raw.smtpUser || "" : process.env.SMTP_USER || "").trim();
  const pass = String(databaseConfigured ? raw.smtpPass || "" : process.env.SMTP_PASS || "");

  return {
    host,
    port: Number(databaseConfigured ? raw.smtpPort || 587 : process.env.SMTP_PORT || 587),
    secure: databaseConfigured
      ? Boolean(raw.smtpSecure)
      : String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: user ? { user, pass } : undefined,
    from
  };
}

async function reminderConfig(): Promise<ReminderConfig> {
  const settings = await prisma.appSetting.findUnique({ where: { id: "global" } });
  const raw = settings as any;
  const timing = ["BEFORE_DUE", "ON_DUE", "AFTER_DUE"].includes(raw?.loanReminderTiming)
    ? raw.loanReminderTiming as ReminderTiming
    : "AFTER_DUE";

  return {
    enabled: raw?.loanReminderEnabled ?? true,
    timing,
    days: Math.max(0, Number(raw?.loanReminderDays ?? 0)),
    repeatDays: Math.max(0, Number(raw?.loanReminderRepeatDays ?? 1)),
    subject: String(raw?.loanReminderSubject || DEFAULT_SUBJECT),
    message: String(raw?.loanReminderMessage || DEFAULT_MESSAGE)
  };
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (match, key: string) => values[key] ?? match);
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function firstReminderAt(dueAt: Date, config: ReminderConfig) {
  const date = startOfLocalDay(dueAt);
  const direction = config.timing === "BEFORE_DUE" ? -1 : config.timing === "AFTER_DUE" ? 1 : 0;
  date.setDate(date.getDate() + direction * config.days);
  return date;
}

export async function emailRemindersConfigured() {
  return Boolean(await smtpConfig());
}

export async function sendLoanReminder(loanId: string) {
  const config = await smtpConfig();
  if (!config) throw new Error("Email reminders are not configured. Add SMTP settings on the Admin Settings page.");

  const reminder = await reminderConfig();
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      assetTag: {
        include: {
          gameCopy: { include: { game: true, collection: true } },
          collectionItem: { include: { collection: true } }
        }
      }
    }
  });

  if (!loan) throw new Error("Loan not found");
  if (!loan.borrowerEmail) throw new Error("This borrower does not have an email address");
  if (loan.status !== "CHECKED_OUT" || loan.returnedAt) throw new Error("This loan is no longer active");

  const title = loan.assetTag.gameCopy?.game.title || loan.assetTag.collectionItem?.name || loan.assetTag.tag;
  const collectionName = loan.assetTag.gameCopy?.collection.name || loan.assetTag.collectionItem?.collection.name || "VGC Shelf";
  const values = {
    borrowerName: loan.borrowerName,
    borrowerEmail: loan.borrowerEmail,
    title,
    assetTag: loan.assetTag.tag,
    collectionName,
    dueDate: loan.dueAt ? new Date(loan.dueAt).toLocaleDateString("en-US") : "as soon as possible",
    checkoutDate: new Date(loan.checkedOutAt).toLocaleDateString("en-US")
  };

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });

  await transporter.sendMail({
    from: config.from,
    to: loan.borrowerEmail,
    subject: renderTemplate(reminder.subject, values),
    text: renderTemplate(reminder.message, values)
  });

  return prisma.loan.update({
    where: { id: loan.id },
    data: { reminderSentAt: new Date() }
  });
}

export async function sendAutomaticOverdueReminders() {
  const reminder = await reminderConfig();
  if (!reminder.enabled || !(await emailRemindersConfigured())) return { sent: 0 };

  const now = new Date();
  const loans = await prisma.loan.findMany({
    where: {
      status: "CHECKED_OUT",
      returnedAt: null,
      dueAt: { not: null },
      borrowerEmail: { not: null }
    },
    select: { id: true, dueAt: true, reminderSentAt: true }
  });

  let sent = 0;
  for (const loan of loans) {
    if (!loan.dueAt || now < firstReminderAt(loan.dueAt, reminder)) continue;

    if (loan.reminderSentAt) {
      if (reminder.repeatDays === 0) continue;
      const repeatAt = new Date(loan.reminderSentAt.getTime() + reminder.repeatDays * 24 * 60 * 60 * 1000);
      if (now < repeatAt) continue;
    }

    try {
      await sendLoanReminder(loan.id);
      sent += 1;
    } catch (error) {
      console.error(`Failed to send reminder for loan ${loan.id}:`, error);
    }
  }

  return { sent };
}

export function startLoanReminderScheduler() {
  const run = () => sendAutomaticOverdueReminders().catch((error) => console.error("Loan reminder run failed:", error));
  setTimeout(run, 30_000);
  setInterval(run, 6 * 60 * 60 * 1000);
}
