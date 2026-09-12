"use client";

import { useState } from "react";
import { createEscrow, ESCROW_GUARD_CONTRACT_ADDRESS, type WalletAddress } from "@/lib/genlayer";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export default function EscrowPage() {
  const [projectTitle, setProjectTitle] = useState("Agent bounty milestone");
  const [payeeWallet, setPayeeWallet] = useState("0x0000000000000000000000000000000000000001");
  const [currency, setCurrency] = useState("GEN");
  const [totalBudget, setTotalBudget] = useState("1000");
  const [termsUrl, setTermsUrl] = useState("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/milestone-terms.md");
  const [repoUrl, setRepoUrl] = useState("https://github.com/klopp78/escrowguard-genlayer");
  const [policyUrl, setPolicyUrl] = useState("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/acceptance-policy.md");
  const [address, setAddress] = useState(ESCROW_GUARD_CONTRACT_ADDRESS);
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [message, setMessage] = useState("Connect a browser wallet to create an escrow baseline.");
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
      setMessage("Waiting for GenLayer validators to bind the baseline snapshots...");
      const account = wallet ?? (await connectWallet());
      const result = await createEscrow({
        walletAddress: account,
        projectTitle,
        payeeWallet,
        currency,
        totalBudget,
        milestoneTermsUrl: termsUrl,
        repositoryUrl: repoUrl,
        acceptancePolicyUrl: policyUrl,
        contractAddress: address as `0x${string}`,
      });
      setRecord(typeof result.escrow === "string" ? result.escrow : JSON.stringify(result.escrow, null, 2));
      setMessage(`Escrow baseline accepted: ${result.escrowId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-[#161814]">
      <a className="pill" href="/">EscrowGuard</a>
      <h1 className="mt-7 text-4xl font-semibold">Create escrow baseline</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-[#596452]">
        Register the budget boundary and source commitments before any milestone
        release can be reviewed.
      </p>
      <section className="tool-panel mt-8 grid gap-4">
        <Field id="title" label="Project title" value={projectTitle} setValue={setProjectTitle} />
        <Field id="payee" label="Payee wallet" value={payeeWallet} setValue={setPayeeWallet} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="currency" label="Currency label" value={currency} setValue={setCurrency} />
          <Field id="budget" label="Total budget" value={totalBudget} setValue={setTotalBudget} />
        </div>
        <Field id="terms" label="Milestone terms URL" value={termsUrl} setValue={setTermsUrl} />
        <Field id="repo" label="Work repository URL" value={repoUrl} setValue={setRepoUrl} />
        <Field id="policy" label="Acceptance policy URL" value={policyUrl} setValue={setPolicyUrl} />
        <Field id="address" label="Studio contract address" value={address} setValue={setAddress} />
        <div className="flex flex-wrap gap-3">
          <button className="action-button" onClick={() => connectWallet().then(() => setMessage("Wallet connected.")).catch((error) => setMessage(error.message))}>Connect wallet</button>
          <button className="action-button primary" disabled={busy} onClick={submit}>{busy ? "Awaiting consensus" : "Create escrow"}</button>
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
