# EscrowGuard for GenLayer

EscrowGuard v2 is a GenLayer-native milestone settlement workflow for AI-agent work, upgraded for Bradbury Phase 2. It lets a payer register immutable scope, settlement-executor, payment and fee boundaries, then lets the payer or payee request validator review before a bound executor can create a one-use settlement receipt.

## Why it exists

AI agents and small teams increasingly ship work against loose instructions: a bounty, a prompt, a task list, or a lightweight scope document. Payment should not rely on a private dashboard or an after-the-fact local score. EscrowGuard makes the release boundary explicit:

- the original milestone terms, repository, and acceptance policy are fetched, committed, and preserved at escrow creation;
- each escrow records deposited value, funded value, released value, remaining budget, fee reserve, spent fee reserve, and a named settlement executor;
- deliverable, evidence pack, and test report snapshots are fetched and hashed during review;
- validator adjudication receives the fetched milestone terms and acceptance policy alongside the release evidence;
- validators independently recompute snapshot commitments before accepting a release record;
- each release has a canonical `release_intent_hash` binding payer, payee, executor, amount, fee cap, original baseline, and fetched evidence commitments;
- untrusted evidence is greybox-screened for instruction-injection markers before it is given to the model, and cannot modify any payment field;
- execution requires an approved `pay_*` receipt, the registered executor, an unspent fee reserve, and a one-use intent binding.

## Contract

`contracts/escrow_guard.py`

Important methods:

- `create_escrow(...)` registers payer, payee, settlement executor, deposited budget, fee reserve, source manifest, and baseline snapshot commitments.
- `request_release(...)` lets the payer or payee ask validators to review milestone evidence plus a bounded fee cap, and stores an approved or blocked release receipt.
- `execute_release(...)` creates an execution receipt only when the named settlement executor presents an approved, unspent release intent inside both payment and fee boundaries.
- `get_escrow(...)`, `get_release(...)`, `get_execution(...)`, and `get_payee_claim(...)` read the stored records.

## Application

The web app has three user flows:

- `/escrow` creates the escrow baseline and reads the accepted escrow record.
- `/release` submits milestone evidence and reads the accepted release record.
- `/records` reads escrow/release/execution/payee-claim records and can execute an approved release.

The frontend uses `genlayer-js` against Studionet and does not display a local mock verdict as a consensus result. Each write is followed by an on-chain record readback that verifies the expected escrow, release, or execution ID before the UI reports success.

## Example evidence

The `examples/` directory contains sample milestone terms, acceptance policy, deliverable notes, evidence pack, and test report. These are used as default URLs in the app so reviewers can test the complete flow after the contract is deployed.

## Checks

```bash
npm run contract:check
npm run contract:test
npm run flow:check
npm run build
```

`contract:check` verifies the contract shape and critical guards. `contract:test` executes lifecycle tests for funding, fee-reserve enforcement, executor authentication, approval and rejection, transfer credit, replay prevention, and remaining-budget enforcement. `flow:check` simulates the create-review-execute path and confirms execution depends on an approved receipt.
