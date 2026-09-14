# EscrowGuard for GenLayer

EscrowGuard is a GenLayer-native milestone escrow workflow for AI-agent work. It lets a payer register an immutable funded project baseline, lets the payer or payee request validator review, and lets any caller execute only the amount authorized by an accepted consensus receipt.

## Why it exists

AI agents and small teams increasingly ship work against loose instructions: a bounty, a prompt, a task list, or a lightweight scope document. Payment should not rely on a private dashboard or an after-the-fact local score. EscrowGuard makes the release boundary explicit:

- the original milestone terms, repository, and acceptance policy are fetched, committed, and preserved at escrow creation;
- each escrow records deposited value, funded value, released value, and remaining budget;
- deliverable, evidence pack, and test report snapshots are fetched and hashed during review;
- validator adjudication receives the fetched milestone terms and acceptance policy alongside the release evidence;
- validators independently recompute snapshot commitments before accepting a release record;
- execution requires an approved `pay_*` receipt, refuses over-budget or duplicate payouts, and credits the payee without requiring later payer cooperation.

## Contract

`contracts/escrow_guard.py`

Important methods:

- `create_escrow(...)` registers payer, payee, deposited budget, source manifest, and baseline snapshot commitments.
- `request_release(...)` lets the payer or payee ask validators to review milestone evidence and stores an approved or blocked release receipt.
- `execute_release(...)` creates an execution receipt only when the release is approved and within the funded remaining budget. The caller does not need to be the payer.
- `get_escrow(...)`, `get_release(...)`, `get_execution(...)`, and `get_payee_claim(...)` read the stored records.

## Application

The web app has three user flows:

- `/escrow` creates the escrow baseline and reads the accepted escrow record.
- `/release` submits milestone evidence and reads the accepted release record.
- `/records` reads escrow/release/execution/payee-claim records and can execute an approved release.

The frontend uses `genlayer-js` against Studionet and does not display a local mock verdict as a consensus result.

## Example evidence

The `examples/` directory contains sample milestone terms, acceptance policy, deliverable notes, evidence pack, and test report. These are used as default URLs in the app so reviewers can test the complete flow after the contract is deployed.

## Checks

```bash
npm run contract:check
npm run contract:test
npm run flow:check
npm run build
```

`contract:check` verifies the contract shape and critical guards. `contract:test` executes lifecycle tests for funding, payee-requested review, approval and rejection, transfer credit, replay prevention, and remaining-budget enforcement. `flow:check` simulates the create-review-execute path and confirms execution depends on an approved receipt.
