# EscrowGuard Example Test Report

Checks:
- `npm run contract:check`
- `npm run flow:check`
- `npm run build`

Expected result:
- Contract check verifies the public methods, GenLayer consensus gate, source rendering, SHA-256 commitments, approving receipt requirement, and spending boundary guard.
- Flow check covers create escrow, request release, read release, execute approved release, and read execution receipt.
- Build check confirms the web application compiles.
