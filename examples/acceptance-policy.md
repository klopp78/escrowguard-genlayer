# EscrowGuard Example Acceptance Policy

Validators should approve a release only when all conditions are satisfied:

- The deliverable URL describes completed work for the referenced milestone.
- The evidence pack points to source code, deployment details, or an artifact that can be independently inspected.
- The test report states the checks that were run and whether they passed.
- The requested amount is less than or equal to the escrow remaining budget.
- The release is not a duplicate execution attempt.

Validators should block a release when the evidence contradicts the milestone, when tests fail, or when the requested amount exceeds the spending boundary.

Validators should return needs_review when evidence is inaccessible or too thin to support an approval.
