# EscrowGuard Example Evidence Pack

Evidence bundle:
- Contract source: `contracts/escrow_guard.py`
- Frontend chain adapter: `lib/genlayer.ts`
- Create escrow flow: `app/escrow/page.tsx`
- Release review flow: `app/release/page.tsx`
- Record and execution flow: `app/records/page.tsx`
- Simulated integration check: `scripts/check-full-flow.mjs`

The application does not present local keyword scoring as a consensus result. It waits for accepted contract writes and reads the resulting record back from the deployed GenLayer contract.
