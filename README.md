# EscrowGuard for GenLayer

EscrowGuard is a GenLayer-native milestone escrow workflow for AI-agent work. It lets a payer register an immutable project baseline, ask validators to review milestone delivery evidence, and execute only the amount authorized by an accepted consensus receipt.

## Why it exists

AI agents and small teams increasingly ship work against loose instructions: a bounty, a prompt, a task list, or a lightweight scope document. Payment should not rely on a private dashboard or an after-the-fact local score. EscrowGuard makes the release boundary explicit:

- the original milestone terms, repository, and acceptance policy are committed at escrow creation;
- deliverable, evidence pack, and test report snapshots are fetched and hashed during review;
- validators independently recompute snapshot commitments before accepting a release record;
- execution requires an approved `pay_*` receipt and refuses over-budget or duplicate payouts.

## Contract

`contracts/escrow_guard.py`

Important methods:

- `create_escrow(...)` registers payer, payee, budget, source manifest, and baseline snapshot commitments.
- `request_release(...)` asks validators to review milestone evidence and stores an approved or blocked release receipt.
- `execute_release(...)` creates an execution receipt only when the release is approved and within the remaining budget.
- `get_escrow(...)`, `get_release(...)`, and `get_execution(...)` read the stored records.

## Application

The web app has three user flows:

- `/escrow` creates the escrow baseline and reads the accepted escrow record.
- `/release` submits milestone evidence and reads the accepted release record.
- `/records` reads escrow/release/execution records and can execute an approved release.

The frontend uses `genlayer-js` against Studionet and does not display a local mock verdict as a consensus result.

## Example evidence

The `examples/` directory contains sample milestone terms, acceptance policy, deliverable notes, evidence pack, and test report. These are used as default URLs in the app so reviewers can test the complete flow after the contract is deployed.

## Checks

```bash
npm run contract:check
npm run flow:check
npm run build
```

`contract:check` verifies the contract shape and critical guards. `flow:check` simulates the create-review-execute path and confirms execution depends on an approved receipt.
