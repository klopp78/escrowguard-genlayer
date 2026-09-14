"use client";

import { useState } from "react";
import { ESCROW_GUARD_CONTRACT_ADDRESS, executeRelease, readEscrow, readExecution, readPayeeClaim, readRelease, type WalletAddress } from "@/lib/genlayer";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export default function RecordsPage() {
  const [escrowId, setEscrowId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [payeeWallet, setPayeeWallet] = useState("0x2222222222222222222222222222222222222222");
  const [currency, setCurrency] = useState("GEN");
  const [address, setAddress] = useState(ESCROW_GUARD_CONTRACT_ADDRESS);
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [message, setMessage] = useState("Read an escrow, release, or execution receipt from the deployed contract.");
  const [record, setRecord] = useState("");
  const [busy, setBusy] = useState(false);

  async function connectWallet() {
    if (!window.ethereum) throw new Error("No browser wallet detected.");
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as WalletAddress[];
    if (!accounts[0]) throw new Error("No wallet account returned.");
    setWallet(accounts[0]);
    return accounts[0];
  }

  async function read(kind: "escrow" | "release" | "execution" | "payee claim") {
    try {
      setBusy(true);
      const options = { walletAddress: wallet ?? undefined, contractAddress: address as `0x${string}` };
      const value =
        kind === "escrow"
          ? await readEscrow(escrowId, options)
          : kind === "release"
            ? await readRelease(releaseId, options)
            : kind === "execution"
              ? await readExecution(releaseId, options)
              : await readPayeeClaim(payeeWallet, currency, options);
      setRecord(typeof value === "string" ? value : JSON.stringify(value, null, 2));
      setMessage(`${kind} record loaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    try {
      setBusy(true);
      setRecord("");
      const account = wallet ?? (await connectWallet());
      const result = await executeRelease(account, escrowId, releaseId, address as `0x${string}`);
      setRecord(typeof result.execution === "string" ? result.execution : JSON.stringify(result.execution, null, 2));
      setMessage("Execution receipt accepted and stored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-[#161814]">
      <a className="pill" href="/">EscrowGuard</a>
      <h1 className="mt-7 text-4xl font-semibold">Inspect and execute receipts</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-[#596452]">
        Read exact on-chain records or execute an approved release receipt.
        Anyone can execute an approved receipt; the contract credits the payee
        and refuses blocked reviews, repeats, and over-funded payouts.
      </p>
      <section className="tool-panel mt-8 grid gap-4">
        <Field id="escrow" label="Escrow ID" value={escrowId} setValue={setEscrowId} />
        <Field id="release" label="Release ID" value={releaseId} setValue={setReleaseId} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="payee" label="Payee wallet" value={payeeWallet} setValue={setPayeeWallet} />
          <Field id="currency" label="Currency" value={currency} setValue={setCurrency} />
        </div>
        <Field id="address" label="Studio contract address" value={address} setValue={setAddress} />
        <div className="flex flex-wrap gap-3">
          <button className="action-button" onClick={() => connectWallet().then(() => setMessage("Wallet connected.")).catch((error) => setMessage(error.message))}>Connect wallet</button>
          <button className="action-button" disabled={busy || !escrowId} onClick={() => read("escrow")}>Read escrow</button>
          <button className="action-button" disabled={busy || !releaseId} onClick={() => read("release")}>Read release</button>
          <button className="action-button" disabled={busy || !releaseId} onClick={() => read("execution")}>Read execution</button>
          <button className="action-button" disabled={busy || !payeeWallet || !currency} onClick={() => read("payee claim")}>Read payee claim</button>
          <button className="action-button primary" disabled={busy || !escrowId || !releaseId} onClick={execute}>Execute approved release</button>
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
