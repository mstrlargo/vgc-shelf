import { Router } from "express";
import { LoanStatus } from "@prisma/client";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { emailRemindersConfigured, sendLoanReminder } from "../mailer.js";

const router = Router();
router.use(requireAuth);

function loanInclude() {
  return {
    checkedOutBy: { select: { id: true, name: true, email: true } },
    assetTag: {
      include: {
        gameCopy: { include: { game: { include: { platform: true } }, collection: true } },
        collectionItem: { include: { collection: true } }
      }
    }
  };
}

function serializeLoan(loan: any) {
  const gameCopy = loan.assetTag.gameCopy;
  const item = loan.assetTag.collectionItem;
  return {
    id: loan.id,
    assetTagId: loan.assetTagId,
    assetTag: loan.assetTag.tag,
    title: gameCopy?.game.title || item?.name || loan.assetTag.tag,
    platform: gameCopy?.game.platform?.name || item?.platform || null,
    collectionName: gameCopy?.collection.name || item?.collection.name || "Unknown collection",
    borrowerName: loan.borrowerName,
    borrowerEmail: loan.borrowerEmail,
    checkedOutAt: loan.checkedOutAt,
    dueAt: loan.dueAt,
    returnedAt: loan.returnedAt,
    status: loan.status,
    checkoutNotes: loan.checkoutNotes,
    returnNotes: loan.returnNotes,
    reminderSentAt: loan.reminderSentAt,
    checkedOutBy: loan.checkedOutBy,
    overdue: loan.status === LoanStatus.CHECKED_OUT && loan.dueAt && new Date(loan.dueAt).getTime() < Date.now(),
    url: `/assets/${encodeURIComponent(loan.assetTag.tag)}`
  };
}

async function accessibleCollectionIds(userId: string) {
  const memberships = await prisma.collectionMember.findMany({ where: { userId }, select: { collectionId: true } });
  return memberships.map((membership) => membership.collectionId);
}

function accessWhere(collectionIds: string[]) {
  return {
    OR: [
      { assetTag: { gameCopy: { collectionId: { in: collectionIds } } } },
      { assetTag: { collectionItem: { collectionId: { in: collectionIds } } } }
    ]
  };
}

router.get("/overview", async (req, res, next) => {
  try {
    const collectionIds = await accessibleCollectionIds(req.user!.id);
    const loans = await prisma.loan.findMany({
      where: accessWhere(collectionIds),
      include: loanInclude(),
      orderBy: { checkedOutAt: "desc" }
    });

    const serialized = loans.map(serializeLoan);
    const active = serialized.filter((loan) => loan.status === LoanStatus.CHECKED_OUT && !loan.returnedAt);
    const overdue = active.filter((loan) => loan.overdue);

    const borrowerMap = new Map<string, any>();
    for (const loan of serialized) {
      const key = `${loan.borrowerName.trim().toLowerCase()}|${(loan.borrowerEmail || "").trim().toLowerCase()}`;
      const current = borrowerMap.get(key) || {
        borrowerName: loan.borrowerName,
        borrowerEmail: loan.borrowerEmail,
        totalLoans: 0,
        activeLoans: 0,
        overdueLoans: 0,
        lastCheckoutAt: loan.checkedOutAt
      };
      current.totalLoans += 1;
      if (loan.status === LoanStatus.CHECKED_OUT && !loan.returnedAt) current.activeLoans += 1;
      if (loan.overdue) current.overdueLoans += 1;
      if (new Date(loan.checkedOutAt) > new Date(current.lastCheckoutAt)) current.lastCheckoutAt = loan.checkedOutAt;
      borrowerMap.set(key, current);
    }

    res.json({
      emailRemindersConfigured: await emailRemindersConfigured(),
      summary: { active: active.length, overdue: overdue.length, borrowers: borrowerMap.size, totalLoans: serialized.length },
      active,
      overdue,
      history: serialized,
      borrowers: Array.from(borrowerMap.values()).sort((a, b) => b.totalLoans - a.totalLoans)
    });
  } catch (err) {
    next(err);
  }
});

router.post("/loans/:id/remind", async (req, res, next) => {
  try {
    const collectionIds = await accessibleCollectionIds(req.user!.id);
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, ...accessWhere(collectionIds) } });
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    const updated = await sendLoanReminder(loan.id);
    res.json({ loan: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
