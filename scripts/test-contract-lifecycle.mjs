import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const PAYER = "0x1111111111111111111111111111111111111111";
const PAYEE = "0x2222222222222222222222222222222222222222";
const THIRD_PARTY = "0x3333333333333333333333333333333333333333";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

function source(url, type, index) {
  const canonicalUrl = url.replace(/[?#].*$/, "");
  return {
    source_index: index,
    source_type: type,
    host: new URL(canonicalUrl).host.toLowerCase(),
    canonical_url: canonicalUrl,
    url_hash: sha256(canonicalUrl),
  };
}

function renderedText(url) {
  const path = url.split("/").pop();
  const fixtures = {
    "milestone-terms.md": "Milestone terms: deliver a working escrow UI, tests, and deployment docs.",
    "acceptance-policy.md": "Acceptance policy: approve only if tests pass and the release matches milestone terms.",
    "deliverable.md": "Deliverable: implemented escrow UI and deployed contract.",
    "evidence-pack.md": "Evidence pack: repository, contract address, and screenshots are included.",
    "test-report.md": "Test report: all checks passed.",
    "failing-test-report.md": "Test report: failing checks.",
  };
  return fixtures[path] ?? `Repository or source page: ${url}`;
}

function snapshots(sources) {
  return sources.map((item) => {
    const text = renderedText(item.canonical_url);
    return {
      source_index: item.source_index,
      source_type: item.source_type,
      canonical_url: item.canonical_url,
      url_hash: item.url_hash,
      snapshot_hash: sha256(text),
      snapshot_chars: text.length,
      text,
    };
  });
}

function commitments(sources, sourceSnapshots) {
  return sources.map((item, index) => ({
    source_index: item.source_index,
    source_type: item.source_type,
    host: item.host,
    canonical_url: item.canonical_url,
    url_hash: item.url_hash,
    snapshot_hash: sourceSnapshots[index].snapshot_hash,
    snapshot_chars: sourceSnapshots[index].snapshot_chars,
  }));
}

class EscrowGuardModel {
  constructor() {
    this.sender = PAYER;
    this.escrows = new Map();
    this.releases = new Map();
    this.executions = new Map();
    this.claims = new Map();
    this.escrowCount = 0;
  }

  createEscrow() {
    const escrowSources = [
      source("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/milestone-terms.md", "milestone_terms", 1),
      source("https://github.com/klopp78/escrowguard-genlayer", "work_repository", 2),
      source("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/acceptance-policy.md", "acceptance_policy", 3),
    ];
    const sourceSnapshots = snapshots(escrowSources);
    const snapshotCommitments = commitments(escrowSources, sourceSnapshots);
    const reviewMaterials = Object.fromEntries(
      sourceSnapshots
        .filter((item) => ["milestone_terms", "acceptance_policy"].includes(item.source_type))
        .map((item) => [
          item.source_type,
          {
            canonical_url: item.canonical_url,
            snapshot_hash: item.snapshot_hash,
            snapshot_excerpt: item.text.slice(0, 1600),
          },
        ]),
    );
    const baseline = {
      project_title: "Agent bounty milestone",
      payer: PAYER,
      payee: PAYEE,
      currency: "GEN",
      total_budget: 1000,
      snapshot_commitments: snapshotCommitments,
      review_materials: reviewMaterials,
    };
    const baselineRecord = {
      payer: PAYER,
      payee: PAYEE,
      snapshot_commitments: snapshotCommitments,
      review_materials: reviewMaterials,
      source_bundle_hash: sha256(canonicalJson(escrowSources)),
      baseline_hash: sha256(canonicalJson(baseline)),
    };
    const escrowId = `esc_${sha256(`${PAYER}|${PAYEE}|agent bounty milestone|${baselineRecord.baseline_hash}`).slice(0, 20)}`;
    this.escrowCount += 1;
    this.escrows.set(escrowId, {
      schema_version: "escrowguard.v2",
      escrow_id: escrowId,
      project_title: "Agent bounty milestone",
      payer: PAYER,
      payee: PAYEE,
      currency: "GEN",
      total_budget: 1000,
      funded_value: 1000,
      deposited_value: 1000,
      remaining_budget: 1000,
      released_value: 0,
      funding_status: "funded_at_registration",
      baseline: baselineRecord,
      release_ids: [],
    });
    return escrowId;
  }

  requestRelease(escrowId, amount, testReport, sender) {
    this.sender = sender;
    const escrow = this.escrows.get(escrowId);
    if (!escrow) throw new Error("escrow_not_found");
    if (![escrow.payer, escrow.payee].includes(sender)) throw new Error("only_payer_or_payee_can_request_release_review");
    if (amount > escrow.remaining_budget) throw new Error("requested_amount_exceeds_remaining_budget");
    if (amount > escrow.deposited_value - escrow.released_value) throw new Error("requested_amount_exceeds_funded_balance");

    const releaseSources = [
      source("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/deliverable.md", "deliverable", 1),
      source("https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/evidence-pack.md", "evidence_pack", 2),
      source(`https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/${testReport}`, "test_report", 3),
    ];
    const releaseSnapshots = snapshots(releaseSources);
    const snapshotCommitments = commitments(releaseSources, releaseSnapshots);
    const evidenceBundleHash = sha256(canonicalJson(snapshotCommitments));
    const adjudicationContextHash = sha256(canonicalJson({
      baseline_hash: escrow.baseline.baseline_hash,
      milestone_terms: escrow.baseline.review_materials.milestone_terms,
      acceptance_policy: escrow.baseline.review_materials.acceptance_policy,
      release_snapshot_commitments: snapshotCommitments,
    }));
    const approved = !renderedText(releaseSources[2].canonical_url).includes("failing");
    const releaseId = `pay_${sha256(`${escrowId}|milestone-1|${amount}|${evidenceBundleHash}`).slice(0, 20)}`;
    const record = {
      schema_version: "escrowguard.release.v2",
      release_id: releaseId,
      escrow_id: escrowId,
      requester: sender,
      milestone_key: "milestone-1",
      requested_amount: amount,
      authorized_amount: approved ? amount : 0,
      state: approved ? "approved" : "blocked",
      baseline_hash: escrow.baseline.baseline_hash,
      adjudication_context_hash: adjudicationContextHash,
      evidence_bundle_hash: evidenceBundleHash,
      snapshot_commitments: snapshotCommitments,
      consensus_result: {
        decision: approved ? "approved" : "blocked",
        tests_passed: approved,
        budget_ok: true,
      },
      execution_ready: approved,
    };
    this.releases.set(releaseId, record);
    escrow.release_ids.push(releaseId);
    return releaseId;
  }

  executeRelease(escrowId, releaseId, sender) {
    const escrow = this.escrows.get(escrowId);
    const release = this.releases.get(releaseId);
    if (!escrow) throw new Error("escrow_not_found");
    if (!release) throw new Error("release_not_found");
    if (release.state !== "approved" || release.execution_ready !== true) throw new Error("release_requires_approving_receipt");
    if (this.executions.has(releaseId)) throw new Error("release_already_executed");
    const amount = release.authorized_amount;
    if (amount <= 0 || amount > escrow.remaining_budget) throw new Error("execution_exceeds_spending_boundary");
    if (amount > escrow.deposited_value - escrow.released_value) throw new Error("execution_exceeds_funded_balance");

    escrow.remaining_budget -= amount;
    escrow.released_value += amount;
    release.state = "executed";
    release.execution_ready = false;
    const claimKey = `${escrow.payee}|${escrow.currency}`;
    const claim = this.claims.get(claimKey) ?? {
      payee: escrow.payee,
      currency: escrow.currency,
      claimable_amount: 0,
      release_ids: [],
    };
    claim.claimable_amount += amount;
    claim.release_ids.push(releaseId);
    this.claims.set(claimKey, claim);
    this.executions.set(releaseId, {
      release_id: releaseId,
      escrow_id: escrowId,
      executed_by: sender,
      payee: escrow.payee,
      executed_amount: amount,
      remaining_budget: escrow.remaining_budget,
      released_value: escrow.released_value,
      payee_claimable_amount: claim.claimable_amount,
      transfer_mechanism: "contract_state_credit_to_payee",
      status: "executed",
    });
  }
}

function expectError(fn, message) {
  assert.throws(fn, (error) => String(error.message).includes(message));
}

const model = new EscrowGuardModel();
const escrowId = model.createEscrow();
const escrow = model.escrows.get(escrowId);
assert.equal(escrow.funded_value, 1000);
assert.equal(escrow.deposited_value, 1000);
assert.ok(escrow.baseline.review_materials.milestone_terms.snapshot_hash);
assert.ok(escrow.baseline.review_materials.acceptance_policy.snapshot_hash);

expectError(() => model.requestRelease(escrowId, 250, "test-report.md", THIRD_PARTY), "only_payer_or_payee_can_request_release_review");
expectError(() => model.requestRelease(escrowId, 1001, "test-report.md", PAYEE), "requested_amount_exceeds_remaining_budget");

const rejectedRelease = model.requestRelease(escrowId, 100, "failing-test-report.md", PAYEE);
assert.equal(model.releases.get(rejectedRelease).state, "blocked");
expectError(() => model.executeRelease(escrowId, rejectedRelease, THIRD_PARTY), "release_requires_approving_receipt");

const approvedRelease = model.requestRelease(escrowId, 250, "test-report.md", PAYEE);
const approved = model.releases.get(approvedRelease);
assert.equal(approved.requester, PAYEE);
assert.equal(approved.state, "approved");
assert.equal(approved.adjudication_context_hash.length, 64);

model.executeRelease(escrowId, approvedRelease, THIRD_PARTY);
const execution = model.executions.get(approvedRelease);
assert.equal(execution.executed_by, THIRD_PARTY);
assert.equal(execution.executed_amount, 250);
assert.equal(execution.remaining_budget, 750);
assert.equal(execution.transfer_mechanism, "contract_state_credit_to_payee");
const claim = model.claims.get(`${PAYEE}|GEN`);
assert.equal(claim.claimable_amount, 250);
assert.deepEqual(claim.release_ids, [approvedRelease]);

expectError(() => model.executeRelease(escrowId, approvedRelease, THIRD_PARTY), "release_requires_approving_receipt");
expectError(() => model.requestRelease(escrowId, 751, "test-report.md", PAYEE), "requested_amount_exceeds_remaining_budget");

console.log("EscrowGuard executable lifecycle tests passed");
