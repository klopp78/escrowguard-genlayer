import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve("contracts/escrow_guard.py");
const source = readFileSync(contractPath, "utf8");
const firstLine = source.split(/\r?\n/, 1)[0];
const expectedRuntime =
  "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

assert(firstLine.includes(expectedRuntime), `missing pinned runtime dependency: ${expectedRuntime}`);
assert(/class\s+EscrowGuard\s*\(\s*gl\.Contract\s*\)\s*:/.test(source), "EscrowGuard must inherit gl.Contract");
assert(!/gl\.get_webpage|gl\.exec_prompt|gl\.json_loads|gl\.json_dumps|gl\.msg/.test(source), "unsupported legacy gl APIs remain");

for (const method of [
  "create_escrow",
  "request_release",
  "execute_release",
  "get_escrow",
  "get_release",
  "get_execution",
  "get_payee_claim",
  "list_escrow_ids",
  "list_release_ids",
]) {
  assert(new RegExp(`def\\s+${method}\\s*\\(`).test(source), `missing method: ${method}`);
}

for (const method of ["create_escrow", "request_release", "execute_release"]) {
  assert(new RegExp(`@gl\\.public\\.write\\s+def\\s+${method}\\s*\\(`, "s").test(source), `${method} must be public.write`);
}

for (const method of ["get_escrow", "get_release", "get_execution", "get_payee_claim", "list_escrow_ids", "list_release_ids"]) {
  assert(new RegExp(`@gl\\.public\\.view\\s+def\\s+${method}\\s*\\(`, "s").test(source), `${method} must be public.view`);
}

assert(/gl\.vm\.run_nondet_unsafe/.test(source), "missing GenLayer consensus gate");
assert(/gl\.nondet\.web\.render/.test(source), "missing source snapshot rendering");
assert(/gl\.nondet\.exec_prompt/.test(source), "missing validator prompt adjudication");
assert(/hashlib\.sha256/.test(source), "must use collision-resistant SHA-256");
assert(/baseline_hash/.test(source), "must persist baseline commitment");
assert(/snapshot_commitments/.test(source), "must persist snapshot commitments");
assert(/release_requires_approving_receipt/.test(source), "execution must require approved receipt");
assert(/execution_exceeds_spending_boundary/.test(source), "execution must enforce spending boundary");
assert(/funded_value/.test(source) && /deposited_value/.test(source), "escrows must persist funded deposited value");
assert(/only_payer_or_payee_can_request_release_review/.test(source), "payee-requested review guard missing");
assert(!/only_payer_can_execute_release/.test(source), "execution must not require payer cooperation after approval");
assert(/contract_state_credit_to_payee/.test(source), "payee transfer ledger missing");
assert(/milestone_terms_snapshot/.test(source) && /acceptance_policy_snapshot/.test(source), "adjudication must include fetched baseline terms and policy");
assert(/adjudication_context_hash/.test(source), "adjudication context commitment missing");

const escrowId = `esc_${sha256("payer|payee|title|baseline").slice(0, 20)}`;
const releaseId = `pay_${sha256("escrow|milestone|250|evidence").slice(0, 20)}`;
assert(escrowId.length === 24, "escrow id format check failed");
assert(releaseId.length === 24, "release id format check failed");

console.log("EscrowGuard contract check passed");
