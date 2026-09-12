import { ESCROW_GUARD_CONTRACT_ADDRESS } from "@/lib/genlayer";

const repoUrl = "https://github.com/klopp78/escrowguard-genlayer";
const studioUrl = `https://explorer-studio.genlayer.com/address/${ESCROW_GUARD_CONTRACT_ADDRESS}`;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4f6f2] text-[#161814]">
      <section className="border-b border-[#d9ded2] bg-[#fbfcf8]">
        <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
          <span className="pill">GenLayer Project</span>
          <div className="mt-7 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
                EscrowGuard
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-[#596452]">
                Milestone escrow for AI work. Create a bounded budget, ask
                validators to inspect delivery evidence, then execute only the
                amount authorized by an accepted consensus receipt.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="action-button primary" href="/escrow">Create escrow</a>
                <a className="action-button" href="/release">Review milestone</a>
                <a className="action-button" href="/records">Inspect records</a>
              </div>
            </div>
            <div className="escrow-board">
              <div>
                <span>Budget boundary</span>
                <strong>Remaining balance is enforced before every execution</strong>
              </div>
              <div>
                <span>Evidence admission</span>
                <strong>Terms, repository, policy, deliverable, proof, and tests are hashed</strong>
              </div>
              <div>
                <span>Consensus receipt</span>
                <strong>Only approved pay_* records can become execution receipts</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-8 md:grid-cols-3 lg:px-8">
        <article className="tool-panel">
          <span className="field-label">01 Register</span>
          <h2 className="mt-2 text-2xl font-semibold">Immutable baseline</h2>
          <p className="mt-3 leading-7 text-[#596452]">
            The contract records original milestone terms, repository, and
            acceptance policy as SHA-256 commitments before release review.
          </p>
          <a className="mt-5 inline-block text-sm font-semibold text-[#25614b]" href="/escrow">Open escrow flow</a>
        </article>
        <article className="tool-panel">
          <span className="field-label">02 Review</span>
          <h2 className="mt-2 text-2xl font-semibold">Consensus release gate</h2>
          <p className="mt-3 leading-7 text-[#596452]">
            Validators fetch deliverable, evidence pack, and test report
            snapshots before deciding whether a milestone can unlock payment.
          </p>
          <a className="mt-5 inline-block text-sm font-semibold text-[#25614b]" href="/release">Open release flow</a>
        </article>
        <article className="tool-panel">
          <span className="field-label">03 Execute</span>
          <h2 className="mt-2 text-2xl font-semibold">Bounded payout receipt</h2>
          <p className="mt-3 leading-7 text-[#596452]">
            Execution is a separate write. It refuses unapproved receipts,
            repeats, and any amount outside the escrow&apos;s remaining budget.
          </p>
          <a className="mt-5 inline-block text-sm font-semibold text-[#25614b]" href="/records">Open records</a>
        </article>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 px-5 pb-10 text-sm text-[#596452] lg:px-8">
        <a href={repoUrl} rel="noreferrer" target="_blank">Source repository</a>
        <a href={studioUrl} rel="noreferrer" target="_blank">Studio contract</a>
        <code>{ESCROW_GUARD_CONTRACT_ADDRESS}</code>
      </footer>
    </main>
  );
}
