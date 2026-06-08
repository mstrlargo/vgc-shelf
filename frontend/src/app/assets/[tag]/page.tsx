"use client";

import { useEffect, useState } from "react";
import { activeLoan, assetSubtitle, assetTitle, AssetTag, getAsset, Loan, qrUrlForAsset } from "@/lib/assets";
import { api, User } from "@/lib/api";
import { Branding, loadBranding } from "@/lib/branding";
import { printAssetLabel } from "@/components/SmallAssetLabel";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Shell } from "@/components/Shell";

export default function AssetDetailPage({ params }: { params: { tag: string } }) {
  const [asset, setAsset] = useState<AssetTag | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [branding, setBranding] = useState<Branding>({ appName: "VGC Shelf", pageTitle: "VGC Shelf", appIconUrl: null });
  const [message, setMessage] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  async function load() {
    const [assetData, meData, brandingData] = await Promise.all([
      getAsset(decodeURIComponent(params.tag)),
      api<{ user: User }>("/auth/me").catch(() => ({ user: null as unknown as User })),
      loadBranding()
    ]);

    setAsset(assetData.asset);
    setLoan(assetData.activeLoan || activeLoan(assetData.asset));
    setUser(meData.user);
    setBranding(brandingData);
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;

    setMessage("");

    try {
      await api(`/assets/${asset.id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          borrowerName,
          borrowerEmail: borrowerEmail || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          checkoutNotes: checkoutNotes || null
        })
      });

      setShowCheckout(false);
      setBorrowerName("");
      setBorrowerEmail("");
      setDueAt("");
      setCheckoutNotes("");
      setMessage("Asset checked out.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to check out asset.");
    }
  }

  async function checkin() {
    if (!asset) return;

    setMessage("");

    try {
      await api(`/assets/${asset.id}/checkin`, {
        method: "POST",
        body: JSON.stringify({
          returnNotes: returnNotes || null
        })
      });

      setReturnNotes("");
      setMessage("Asset checked in.");
      await load();
    } catch (err: any) {
      setMessage(err.message || "Failed to check in asset.");
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, [params.tag]);

  return (
    <Shell>
      <a href="/collections" className="vgc-accent-text text-sm hover:opacity-80">← Back to collections</a>

      {message && <p className="my-6 rounded-lg bg-zinc-800 p-3 text-sm">{message}</p>}

      {asset && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <img src={qrUrlForAsset(asset.tag)} alt={`QR code for ${asset.tag}`} className="mx-auto h-56 w-56 rounded bg-white p-3" />
            <div className="mt-4 text-center">
              <div className="text-xs text-zinc-400">Asset Tag</div>
              <div className="font-mono text-2xl font-bold">{asset.tag}</div>
              <button
                className="mt-3 rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
                onClick={() => printAssetLabel({ assetTag: asset, user, branding })}
              >
                Print label only
              </button>
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-bold">{assetTitle(asset)}</h2>
            <p className="vgc-muted mt-1 text-sm text-zinc-400">{assetSubtitle(asset)}</p>

            <div className="mt-5 rounded-xl bg-zinc-900 p-4">
              {loan ? (
                <div>
                  <div className="text-lg font-semibold text-red-300">Checked out</div>
                  <p className="mt-2">Borrower: {loan.borrowerName}</p>
                  {loan.borrowerEmail && <p className="vgc-muted text-sm text-zinc-400">Email: {loan.borrowerEmail}</p>}
                  <p className="vgc-muted text-sm text-zinc-400">Checked out: {new Date(loan.checkedOutAt).toLocaleString()}</p>
                  {loan.dueAt && <p className="vgc-muted text-sm text-zinc-400">Due: {new Date(loan.dueAt).toLocaleDateString()}</p>}
                  {loan.checkoutNotes && <p className="vgc-muted mt-2 text-sm text-zinc-400">{loan.checkoutNotes}</p>}

                  <div className="mt-4 space-y-3">
                    <textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Return notes" value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} rows={3} />
                    <Button type="button" onClick={checkin}>Check in / return</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-lg font-semibold text-green-300">Available</div>
                  <Button className="mt-4" type="button" onClick={() => setShowCheckout(true)}>Check out</Button>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="font-semibold">Loan history</h3>
              <div className="mt-3 space-y-3">
                {asset.loans.map((historyLoan) => (
                  <div key={historyLoan.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm">
                    <div className={historyLoan.status === "CHECKED_OUT" ? "text-red-300" : "text-green-300"}>{historyLoan.status.replaceAll("_", " ")}</div>
                    <div>Borrower: {historyLoan.borrowerName}</div>
                    <div className="vgc-muted text-zinc-400">Out: {new Date(historyLoan.checkedOutAt).toLocaleString()}</div>
                    {historyLoan.returnedAt && <div className="vgc-muted text-zinc-400">Returned: {new Date(historyLoan.returnedAt).toLocaleString()}</div>}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {showCheckout && asset && (
        <Modal title={`Check out ${asset.tag}`} onClose={() => setShowCheckout(false)}>
          <form onSubmit={checkout} className="space-y-3">
            <Input placeholder="Borrower name" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} />
            <Input placeholder="Borrower email" value={borrowerEmail} onChange={(e) => setBorrowerEmail(e.target.value)} />
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            <textarea className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none ring-indigo-500 focus:ring-2" placeholder="Checkout notes" value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} rows={4} />
            <div className="grid grid-cols-2 gap-2">
              <Button type="submit">Check out</Button>
              <Button type="button" onClick={() => setShowCheckout(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
