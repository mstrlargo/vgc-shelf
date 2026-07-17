"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, History, Mail, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Shell } from "@/components/Shell";

type LendingLoan = {
  id: string;
  assetTag: string;
  title: string;
  platform?: string | null;
  collectionName: string;
  borrowerName: string;
  borrowerEmail?: string | null;
  checkedOutAt: string;
  dueAt?: string | null;
  returnedAt?: string | null;
  status: "CHECKED_OUT" | "RETURNED";
  checkoutNotes?: string | null;
  returnNotes?: string | null;
  reminderSentAt?: string | null;
  overdue: boolean;
  url: string;
};

type Borrower = {
  borrowerName: string;
  borrowerEmail?: string | null;
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  lastCheckoutAt: string;
};

type LendingData = {
  emailRemindersConfigured: boolean;
  summary: { active: number; overdue: number; borrowers: number; totalLoans: number };
  active: LendingLoan[];
  overdue: LendingLoan[];
  history: LendingLoan[];
  borrowers: Borrower[];
};

type Tab = "overdue" | "active" | "borrowers" | "history";

function when(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function LendingPage() {
  const [data, setData] = useState<LendingData | null>(null);
  const [tab, setTab] = useState<Tab>("overdue");
  const [message, setMessage] = useState("");
  const [sendingId, setSendingId] = useState("");
  const [borrowerFilter, setBorrowerFilter] = useState("");

  async function load() {
    setData(await api<LendingData>("/lending/overview"));
  }

  async function remind(loan: LendingLoan) {
    setMessage("");
    setSendingId(loan.id);
    try {
      await api(`/lending/loans/${loan.id}/remind`, { method: "POST" });
      setMessage(`Reminder sent to ${loan.borrowerEmail}.`);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to send reminder.");
    } finally {
      setSendingId("");
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    const requestedSearch = params.get("search") || "";

    if (["overdue", "active", "borrowers", "history"].includes(requestedTab || "")) {
      setTab(requestedTab as Tab);
    }

    if (requestedSearch) {
      setBorrowerFilter(requestedSearch);
      setTab("history");
    }

    load().catch((err) => setMessage(err.message));
  }, []);

  const history = useMemo(() => {
    const query = borrowerFilter.trim().toLowerCase();
    if (!query || !data) return data?.history || [];
    return data.history.filter((loan) => `${loan.borrowerName} ${loan.borrowerEmail || ""} ${loan.title} ${loan.assetTag}`.toLowerCase().includes(query));
  }, [data, borrowerFilter]);

  function LoanCard({ loan }: { loan: LendingLoan }) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <a href={loan.url} className="font-semibold vgc-accent-text hover:opacity-80">{loan.title}</a>
            <div className="text-sm text-zinc-400">{loan.collectionName}{loan.platform ? ` · ${loan.platform}` : ""}</div>
            <div className="mt-1 font-mono text-sm">{loan.assetTag}</div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${loan.overdue ? "border-red-700 text-red-300" : loan.status === "RETURNED" ? "border-green-700 text-green-300" : "border-amber-700 text-amber-300"}`}>
            {loan.overdue ? "OVERDUE" : loan.status.replaceAll("_", " ")}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>Borrower: <strong>{loan.borrowerName}</strong></div>
          <div>Email: {loan.borrowerEmail || "Not provided"}</div>
          <div>Checked out: {when(loan.checkedOutAt)}</div>
          <div>Due: {when(loan.dueAt)}</div>
          {loan.returnedAt && <div>Returned: {when(loan.returnedAt)}</div>}
          {loan.reminderSentAt && <div>Last reminder: {when(loan.reminderSentAt)}</div>}
        </div>
        {(loan.checkoutNotes || loan.returnNotes) && (
          <div className="mt-3 rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300">
            {loan.checkoutNotes && <div>Checkout: {loan.checkoutNotes}</div>}
            {loan.returnNotes && <div>Return: {loan.returnNotes}</div>}
          </div>
        )}
        {loan.status === "CHECKED_OUT" && (
          <div className="mt-4">
            <Button type="button" disabled={!loan.borrowerEmail || !data?.emailRemindersConfigured || sendingId === loan.id} onClick={() => remind(loan)}>
              <Mail className="mr-2 h-4 w-4" />
              {sendingId === loan.id ? "Sending..." : "Send reminder"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Lending</h2>
          <p className="text-sm text-zinc-400">Overdue items, borrower history, reminders, and complete checkout activity.</p>
        </div>
      </div>

      {message && <p className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm">{message}</p>}
      {data && !data.emailRemindersConfigured && (
        <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
          Email reminders are disabled. Configure SMTP_HOST and SMTP_FROM in the backend environment. SMTP_PORT, SMTP_SECURE, SMTP_USER, and SMTP_PASS are optional.
        </p>
      )}

      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Active loans", data.summary.active, <Clock3 className="h-5 w-5" />],
              ["Overdue", data.summary.overdue, <AlertTriangle className="h-5 w-5" />],
              ["Borrowers", data.summary.borrowers, <Users className="h-5 w-5" />],
              ["All checkouts", data.summary.totalLoans, <History className="h-5 w-5" />]
            ].map(([label, value, icon]) => (
              <Card key={String(label)}><div className="flex items-center justify-between text-zinc-400">{label}{icon}</div><div className="mt-2 text-3xl font-bold">{String(value)}</div></Card>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(["overdue", "active", "borrowers", "history"] as Tab[]).map((value) => (
              <button key={value} onClick={() => setTab(value)} className={`rounded-xl border px-4 py-2 text-sm ${tab === value ? "vgc-accent-bg border-transparent text-white" : "border-zinc-700"}`}>{value[0].toUpperCase() + value.slice(1)}</button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "overdue" && <div className="space-y-3">{data.overdue.map((loan) => <LoanCard key={loan.id} loan={loan} />)}{data.overdue.length === 0 && <Card>No overdue loans.</Card>}</div>}
            {tab === "active" && <div className="space-y-3">{data.active.map((loan) => <LoanCard key={loan.id} loan={loan} />)}{data.active.length === 0 && <Card>No active loans.</Card>}</div>}
            {tab === "borrowers" && <div className="grid gap-3 md:grid-cols-2">{data.borrowers.map((borrower) => <Card key={`${borrower.borrowerName}-${borrower.borrowerEmail || ""}`}><div className="font-semibold">{borrower.borrowerName}</div><div className="text-sm text-zinc-400">{borrower.borrowerEmail || "No email"}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm"><div><strong>{borrower.totalLoans}</strong><div className="text-zinc-500">Total</div></div><div><strong>{borrower.activeLoans}</strong><div className="text-zinc-500">Active</div></div><div><strong className={borrower.overdueLoans ? "text-red-300" : ""}>{borrower.overdueLoans}</strong><div className="text-zinc-500">Overdue</div></div></div><div className="mt-3 text-xs text-zinc-500">Last checkout: {when(borrower.lastCheckoutAt)}</div></Card>)}</div>}
            {tab === "history" && <><input value={borrowerFilter} onChange={(e) => setBorrowerFilter(e.target.value)} placeholder="Filter by borrower, email, item, or asset tag" className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none" /><div className="space-y-3">{history.map((loan) => <LoanCard key={loan.id} loan={loan} />)}{history.length === 0 && <Card>No matching checkout history.</Card>}</div></>}
          </div>
        </>
      )}
    </Shell>
  );
}
