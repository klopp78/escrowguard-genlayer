"use client";

import { useState } from "react";
import { ESCROW_GUARD_CONTRACT_ADDRESS, requestRelease, type WalletAddress } from "@/lib/genlayer";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export default function ReleasePage() {
  const [escrowId, setEscrowId] = useState("esc_");
  const [milestoneKey, setMilestoneKey] = useState("milestone-1");
  const [amount, setAmount] = useState("250");
  const [deliverableUrl, setDeliverableUrl] = useState("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/deliverable.md");
  const [evidenceUrl, setEvidenceUrl] = useState("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/evidence-pack.md");
  const [testReportUrl, setTestReportUrl] = useState("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/test-report.md");
  const [address, setAddress] = useState(ESCROW_GUARD_CONTRACT_ADDRESS);
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [message, setMessage] = useState("Paste an escrow ID and submit milestone evidence for consensus review.");
  const [record, setRecord] = useState("");
  const [busy, setBusy] = useState(false);

  async function connectWallet() {
    if (!window.ethereum) throw new Error("No browser wallet detected.");
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as WalletAddress[];
    if (!accounts[0]) throw new Error("No wallet account returned.");
    setWallet(accounts[0]);
    return accounts[0];
  }

  async function submit() {
    try {
      setBusy(true);
      setRecord("");
      setMessage("Waiting for validators to inspect milestone evidence...");
      const account = wallet ?? (await connectWallet());
      const result = await requestRelease({
        walletAddress: account,
        escrowId,
        milestoneKey,
        requestedAmount: amount,
        deliverableUrl,
        evidenceUrl,
        testReportUrl,
        contractAddress: address as `0x${string}`,
      });
      setRecord(typeof result.release === "string" ? result.release : JSON.stringify(result.release, null, 2));
      setMessage(`Release review accepted: ${result.releaseId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-[#161814]">
      <a className="pill" href="/">EscrowGuard</a>
      <h1 className="mt-7 text-4xl font-semibold">Review milestone release</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-[#596452]">
        Submit deliverable evidence and test results. The contract stores an
        approved or blocked release receipt tied to fetched source hashes.
      </p>
      <section className="tool-panel mt-8 grid gap-4">
        <Field id="escrow" label="Escrow ID" value={escrowId} setValue={setEscrowId} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="milestone" label="Milestone key" value={milestoneKey} setValue={setMilestoneKey} />
          <Field id="amount" label="Requested amount" value={amount} setValue={setAmount} />
        </div>
        <Field id="deliverable" label="Deliverable URL" value={deliverableUrl} setValue={setDeliverableUrl} />
        <Field id="evidence" label="Evidence pack URL" value={evidenceUrl} setValue={setEvidenceUrl} />
        <Field id="tests" label="Test report URL" value={testReportUrl} setValue={setTestReportUrl} />
        <Field id="address" label="Studio contract address" value={address} setValue={setAddress} />
        <div className="flex flex-wrap gap-3">
          <button className="action-button" onClick={() => connectWallet().then(() => setMessage("Wallet connected.")).catch((error) => setMessage(error.message))}>Connect wallet</button>
          <button className="action-button primary" disabled={busy} onClick={submit}>{busy ? "Awaiting consensus" : "Request release review"}</button>
        </div>
        <p className="text-sm text-[#596452]">{message}</p>
      </section>
      {record ? <pre className="result-card mt-6 overflow-x-auto text-sm">{record}</pre> : null}
    </main>
  );
}

function Field({ id, label, value, setValue }: { id: string; label: string; value: string; setValue: (value: string) => void }) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input className="text-input" id={id} value={value} onChange={(event) => setValue(event.target.value)} />
    </label>
  );
}
