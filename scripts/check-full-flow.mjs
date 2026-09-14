import assert from "node:assert/strict";

const walletAddress = "0x1111111111111111111111111111111111111111";
const payeeAddress = "0x2222222222222222222222222222222222222222";
const escrowId = "esc_9cfe7c9b23f8428f2d3a";
const releaseId = "pay_725bf671258bf0427c5e";

class StudioFlowSimulator {
  constructor() {
    this.calls = [];
    this.escrows = new Map();
    this.releases = new Map();
    this.executions = new Map();
  }

  async writeContract({ functionName, args }) {
    this.calls.push({ kind: "write", functionName, args });
    if (functionName === "create_escrow") {
      const [title, payee, currency, budget, termsUrl, repoUrl, policyUrl] = args;
      assert.equal(title, "Agent bounty milestone");
      assert.equal(payee, payeeAddress);
      assert.equal(currency, "GEN");
      assert.equal(budget, "1000");
      assert.match(termsUrl, /milestone-terms\.md$/);
      assert.match(repoUrl, /github\.com\/klopp78\/escrowguard-genlayer$/);
      assert.match(policyUrl, /acceptance-policy\.md$/);
      this.escrows.set(escrowId, {
        escrow_id: escrowId,
        payer: walletAddress.toLowerCase(),
        payee,
        currency,
        total_budget: 1000,
        funded_value: 1000,
        deposited_value: 1000,
        remaining_budget: 1000,
        released_value: 0,
        baseline: { baseline_hash: "baselinehash" },
        release_ids: [],
      });
      return "0xcreateescrow";
    }
    if (functionName === "request_release") {
      const [submittedEscrowId, milestone, amount, deliverableUrl, evidenceUrl, testUrl] = args;
      assert.equal(submittedEscrowId, escrowId);
      assert.equal(milestone, "milestone-1");
      assert.equal(amount, "250");
      assert.match(deliverableUrl, /deliverable\.md$/);
      assert.match(evidenceUrl, /evidence-pack\.md$/);
      assert.match(testUrl, /test-report\.md$/);
      const escrow = this.escrows.get(escrowId);
      assert.ok(escrow, "escrow must exist before release review");
      this.releases.set(releaseId, {
        release_id: releaseId,
        escrow_id: escrowId,
        state: "approved",
        execution_ready: true,
        authorized_amount: 250,
        evidence_bundle_hash: "a".repeat(64),
        adjudication_context_hash: "b".repeat(64),
        requester: payeeAddress,
      });
      escrow.release_ids.push(releaseId);
      return "0xrequestrelease";
    }
    if (functionName === "execute_release") {
      const [submittedEscrowId, submittedReleaseId] = args;
      assert.equal(submittedEscrowId, escrowId);
      assert.equal(submittedReleaseId, releaseId);
      const release = this.releases.get(releaseId);
      assert.equal(release?.state, "approved");
      const escrow = this.escrows.get(escrowId);
      assert.ok(escrow.remaining_budget >= release.authorized_amount);
      escrow.remaining_budget -= release.authorized_amount;
      escrow.released_value += release.authorized_amount;
      release.state = "executed";
      release.execution_ready = false;
      this.executions.set(releaseId, {
        release_id: releaseId,
        escrow_id: escrowId,
        executed_amount: 250,
        remaining_budget: 750,
        released_value: 250,
        payee_claimable_amount: 250,
        transfer_mechanism: "contract_state_credit_to_payee",
        status: "executed",
      });
      this.payeeClaim = {
        payee: payeeAddress,
        currency: "GEN",
        claimable_amount: 250,
        release_ids: [releaseId],
      };
      return "0xexecuterelease";
    }
    throw new Error(`Unexpected write ${functionName}`);
  }

  async waitForTransactionReceipt({ hash }) {
    this.calls.push({ kind: "receipt", hash });
    if (hash === "0xcreateescrow") return { txExecutionResult: escrowId };
    if (hash === "0xrequestrelease") return { txExecutionResult: releaseId };
    if (hash === "0xexecuterelease") return { txExecutionResult: "execution accepted" };
    throw new Error(`Unknown transaction ${hash}`);
  }

  async readContract({ functionName, args }) {
    this.calls.push({ kind: "read", functionName, args });
    if (functionName === "get_escrow") return JSON.stringify(this.escrows.get(args[0]) ?? {});
    if (functionName === "get_release") return JSON.stringify(this.releases.get(args[0]) ?? {});
    if (functionName === "get_execution") return JSON.stringify(this.executions.get(args[0]) ?? {});
    if (functionName === "get_payee_claim") return JSON.stringify(this.payeeClaim ?? {});
    throw new Error(`Unexpected read ${functionName}`);
  }
}

function receiptString(receipt, pattern, label) {
  const value = Object.values(receipt).find(
    (candidate) => typeof candidate === "string" && pattern.test(candidate),
  );
  assert.ok(value, `Accepted ${label} receipt must contain its returned identifier`);
  return value;
}

async function runFullFlow(client) {
  const escrowHash = await client.writeContract({
    functionName: "create_escrow",
    args: [
      "Agent bounty milestone",
      payeeAddress,
      "GEN",
      "1000",
      "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/milestone-terms.md",
      "https://github.com/klopp78/escrowguard-genlayer",
      "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/acceptance-policy.md",
    ],
  });
  const escrowReceipt = await client.waitForTransactionReceipt({ hash: escrowHash });
  const returnedEscrowId = receiptString(escrowReceipt, /^esc_[a-f0-9]{20}$/, "escrow");
  const escrow = JSON.parse(await client.readContract({
    functionName: "get_escrow",
    args: [returnedEscrowId],
  }));
  assert.equal(escrow.remaining_budget, 1000);
  assert.equal(escrow.deposited_value, 1000);

  const releaseHash = await client.writeContract({
    functionName: "request_release",
    args: [
      returnedEscrowId,
      "milestone-1",
      "250",
      "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/deliverable.md",
      "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/evidence-pack.md",
      "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/test-report.md",
    ],
  });
  const releaseReceipt = await client.waitForTransactionReceipt({ hash: releaseHash });
  const returnedReleaseId = receiptString(releaseReceipt, /^pay_[a-f0-9]{20}$/, "release");
  const release = JSON.parse(await client.readContract({
    functionName: "get_release",
    args: [returnedReleaseId],
  }));
  assert.equal(release.state, "approved");
  assert.equal(release.execution_ready, true);
  assert.equal(release.requester, payeeAddress);

  const executionHash = await client.writeContract({
    functionName: "execute_release",
    args: [returnedEscrowId, returnedReleaseId],
  });
  await client.waitForTransactionReceipt({ hash: executionHash });
  const execution = JSON.parse(await client.readContract({
    functionName: "get_execution",
    args: [returnedReleaseId],
  }));
  assert.equal(execution.status, "executed");
  assert.equal(execution.remaining_budget, 750);
  assert.equal(execution.transfer_mechanism, "contract_state_credit_to_payee");
  const claim = JSON.parse(await client.readContract({
    functionName: "get_payee_claim",
    args: [payeeAddress, "GEN"],
  }));
  assert.equal(claim.claimable_amount, 250);
  return { returnedEscrowId, returnedReleaseId };
}

const simulator = new StudioFlowSimulator();
const outcome = await runFullFlow(simulator);
assert.deepEqual(
  simulator.calls.map((call) => `${call.kind}:${call.functionName ?? call.hash}`),
  [
    "write:create_escrow",
    "receipt:0xcreateescrow",
    "read:get_escrow",
    "write:request_release",
    "receipt:0xrequestrelease",
    "read:get_release",
    "write:execute_release",
    "receipt:0xexecuterelease",
    "read:get_execution",
    "read:get_payee_claim",
  ],
);
assert.equal(outcome.returnedEscrowId, escrowId);
assert.equal(outcome.returnedReleaseId, releaseId);
console.log("EscrowGuard simulated full-flow check passed");
