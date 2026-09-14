import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const ESCROW_GUARD_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_ESCROW_GUARD_CONTRACT_ADDRESS ??
    "0xC41Ec46eA4548A40258B3d9CfA0bC46F8418a024") as `0x${string}`;

export type WalletAddress = `0x${string}`;

export type ChainReadOptions = {
  walletAddress?: WalletAddress;
  contractAddress?: `0x${string}`;
};

export type EscrowInput = {
  walletAddress: WalletAddress;
  projectTitle: string;
  payeeWallet: string;
  currency: string;
  totalBudget: string;
  milestoneTermsUrl: string;
  repositoryUrl: string;
  acceptancePolicyUrl: string;
  contractAddress?: `0x${string}`;
};

export type ReleaseInput = {
  walletAddress: WalletAddress;
  escrowId: string;
  milestoneKey: string;
  requestedAmount: string;
  deliverableUrl: string;
  evidenceUrl: string;
  testReportUrl: string;
  contractAddress?: `0x${string}`;
};

export function createEscrowGuardClient(walletAddress?: WalletAddress) {
  return createClient({
    chain: studionet,
    account: walletAddress,
  });
}

function escrowGuardAddress(contractAddress?: `0x${string}`) {
  return contractAddress ?? ESCROW_GUARD_CONTRACT_ADDRESS;
}

export async function readEscrow(escrowId: string, options: ChainReadOptions = {}) {
  const client = createEscrowGuardClient(options.walletAddress);
  return client.readContract({
    address: escrowGuardAddress(options.contractAddress),
    functionName: "get_escrow",
    args: [escrowId],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function readRelease(releaseId: string, options: ChainReadOptions = {}) {
  const client = createEscrowGuardClient(options.walletAddress);
  return client.readContract({
    address: escrowGuardAddress(options.contractAddress),
    functionName: "get_release",
    args: [releaseId],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function readExecution(releaseId: string, options: ChainReadOptions = {}) {
  const client = createEscrowGuardClient(options.walletAddress);
  return client.readContract({
    address: escrowGuardAddress(options.contractAddress),
    functionName: "get_execution",
    args: [releaseId],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function readPayeeClaim(payeeWallet: string, currency: string, options: ChainReadOptions = {}) {
  const client = createEscrowGuardClient(options.walletAddress);
  return client.readContract({
    address: escrowGuardAddress(options.contractAddress),
    functionName: "get_payee_claim",
    args: [payeeWallet, currency],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function createEscrow({
  walletAddress,
  projectTitle,
  payeeWallet,
  currency,
  totalBudget,
  milestoneTermsUrl,
  repositoryUrl,
  acceptancePolicyUrl,
  contractAddress,
}: EscrowInput) {
  const client = createEscrowGuardClient(walletAddress);
  await client.connect("studionet");
  const address = escrowGuardAddress(contractAddress);
  const hash = await client.writeContract({
    address,
    functionName: "create_escrow",
    args: [
      projectTitle,
      payeeWallet,
      currency,
      totalBudget,
      milestoneTermsUrl,
      repositoryUrl,
      acceptancePolicyUrl,
    ],
    value: BigInt(0),
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    fullTransaction: true,
  });
  const escrowId = idFromReceipt(receipt, /esc_[a-f0-9]{20}/, "escrow");
  const escrow = await readEscrow(escrowId, { walletAddress, contractAddress: address });
  return { hash, receipt, escrowId, escrow };
}

export async function requestRelease({
  walletAddress,
  escrowId,
  milestoneKey,
  requestedAmount,
  deliverableUrl,
  evidenceUrl,
  testReportUrl,
  contractAddress,
}: ReleaseInput) {
  const client = createEscrowGuardClient(walletAddress);
  await client.connect("studionet");
  const address = escrowGuardAddress(contractAddress);
  const hash = await client.writeContract({
    address,
    functionName: "request_release",
    args: [escrowId, milestoneKey, requestedAmount, deliverableUrl, evidenceUrl, testReportUrl],
    value: BigInt(0),
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    fullTransaction: true,
  });
  const releaseId = idFromReceipt(receipt, /pay_[a-f0-9]{20}/, "release");
  const release = await readRelease(releaseId, { walletAddress, contractAddress: address });
  return { hash, receipt, releaseId, release };
}

export async function executeRelease(
  walletAddress: WalletAddress,
  escrowId: string,
  releaseId: string,
  contractAddress?: `0x${string}`,
) {
  const client = createEscrowGuardClient(walletAddress);
  await client.connect("studionet");
  const address = escrowGuardAddress(contractAddress);
  const hash = await client.writeContract({
    address,
    functionName: "execute_release",
    args: [escrowId, releaseId],
    value: BigInt(0),
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    fullTransaction: true,
  });
  const execution = await readExecution(releaseId, { walletAddress, contractAddress: address });
  return { hash, receipt, execution };
}

function idFromReceipt(receipt: unknown, pattern: RegExp, label: string): string {
  const id = collectStrings(receipt)
    .map((value) => value.match(pattern)?.[0])
    .find((value): value is string => Boolean(value));
  if (!id) {
    throw new Error(`Accepted ${label} transaction did not return its ID.`);
  }
  return id;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}
