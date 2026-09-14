# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import hashlib
import json
import typing


class ReleaseVerdict(typing.NamedTuple):
    decision: str
    confidence: u8
    scope_match: bool
    evidence_complete: bool
    tests_passed: bool
    budget_ok: bool
    evidence_bundle_hash: str
    adjudication_context_hash: str
    snapshot_commitments_json: str
    summary: str


class EscrowGuard(gl.Contract):
    """Consensus-reviewed milestone escrow authorization registry."""

    escrow_count: u64
    latest_escrow_id: str
    latest_release_id: str
    escrow_ids: DynArray[str]
    release_ids: DynArray[str]
    escrows: TreeMap[str, str]
    releases: TreeMap[str, str]
    executions: TreeMap[str, str]
    payee_claims: TreeMap[str, str]

    def __init__(self):
        self.escrow_count = u64(0)
        self.latest_escrow_id = ""
        self.latest_release_id = ""

    @gl.public.view
    def get_escrow_count(self) -> u64:
        return self.escrow_count

    @gl.public.view
    def get_latest_escrow_id(self) -> str:
        return self.latest_escrow_id

    @gl.public.view
    def get_latest_release_id(self) -> str:
        return self.latest_release_id

    @gl.public.view
    def get_escrow(self, escrow_id: str) -> str:
        return self.escrows.get(escrow_id, "")

    @gl.public.view
    def get_release(self, release_id: str) -> str:
        return self.releases.get(release_id, "")

    @gl.public.view
    def get_execution(self, release_id: str) -> str:
        return self.executions.get(release_id, "")

    @gl.public.view
    def get_payee_claim(self, payee_wallet: str, currency: str) -> str:
        payee = _canonical_wallet(payee_wallet)
        normalized_currency = _clean_text(currency, 20, "currency_required").upper()
        return self.payee_claims.get(_claim_key(payee, normalized_currency), "")

    @gl.public.view
    def list_escrow_ids(self) -> str:
        return json.dumps([escrow_id for escrow_id in self.escrow_ids], separators=(",", ":"))

    @gl.public.view
    def list_release_ids(self) -> str:
        return json.dumps([release_id for release_id in self.release_ids], separators=(",", ":"))

    @gl.public.write
    def create_escrow(
        self,
        project_title: str,
        payee_wallet: str,
        currency: str,
        total_budget: str,
        milestone_terms_url: str,
        repository_url: str,
        acceptance_policy_url: str,
    ) -> str:
        title = _clean_text(project_title, 120, "project_title_required")
        payee = _canonical_wallet(payee_wallet)
        payer = str(gl.message.sender_address).lower()
        normalized_currency = _clean_text(currency, 20, "currency_required").upper()
        budget = _parse_positive_amount(total_budget, "total_budget_invalid")
        sources = _escrow_sources(milestone_terms_url, repository_url, acceptance_policy_url)

        def leader_fn():
            return _commit_escrow_baseline(title, payer, payee, normalized_currency, budget, sources)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                proposed = json.loads(leader_result.calldata)
                independent = json.loads(
                    _commit_escrow_baseline(title, payer, payee, normalized_currency, budget, sources)
                )
            except Exception:
                return False
            return (
                proposed.get("baseline_hash") == independent.get("baseline_hash")
                and proposed.get("snapshot_commitments") == independent.get("snapshot_commitments")
                and proposed.get("source_bundle_hash") == independent.get("source_bundle_hash")
                and proposed.get("payer") == payer
                and proposed.get("payee") == payee
            )

        baseline = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))
        escrow_id = _escrow_id(payer, payee, title, baseline["baseline_hash"])
        if len(self.escrows.get(escrow_id, "")) > 0:
            raise Exception("escrow_already_registered")

        self.escrow_count = u64(int(self.escrow_count) + 1)
        record = {
            "schema_version": "escrowguard.v2",
            "escrow_id": escrow_id,
            "project_title": title,
            "payer": payer,
            "payee": payee,
            "currency": normalized_currency,
            "total_budget": budget,
            "funded_value": budget,
            "deposited_value": budget,
            "remaining_budget": budget,
            "released_value": 0,
            "funding_status": "funded_at_registration",
            "funding_receipt_hash": _sha256(
                _canonical_json(
                    {
                        "payer": payer,
                        "payee": payee,
                        "currency": normalized_currency,
                        "deposited_value": budget,
                        "baseline_hash": baseline["baseline_hash"],
                    }
                )
            ),
            "source_manifest": sources,
            "baseline": baseline,
            "release_ids": [],
            "created_sequence": int(self.escrow_count),
        }
        self.escrows[escrow_id] = _canonical_json(record)
        self.escrow_ids.append(escrow_id)
        self.latest_escrow_id = escrow_id
        return escrow_id

    @gl.public.write
    def request_release(
        self,
        escrow_id: str,
        milestone_key: str,
        requested_amount: str,
        deliverable_url: str,
        evidence_url: str,
        test_report_url: str,
    ) -> str:
        escrow = _load_json(self.escrows.get(escrow_id, ""), "escrow_not_found")
        requester = str(gl.message.sender_address).lower()
        if requester not in (escrow["payer"], escrow["payee"]):
            raise Exception("only_payer_or_payee_can_request_release_review")

        amount = _parse_positive_amount(requested_amount, "requested_amount_invalid")
        if amount > int(escrow["remaining_budget"]):
            raise Exception("requested_amount_exceeds_remaining_budget")
        if amount > int(escrow["deposited_value"]) - int(escrow["released_value"]):
            raise Exception("requested_amount_exceeds_funded_balance")
        milestone = _clean_text(milestone_key, 80, "milestone_key_required")
        evidence_sources = _release_sources(deliverable_url, evidence_url, test_report_url)

        def leader_fn():
            return _adjudicate_release(escrow, milestone, amount, evidence_sources)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                proposed = _parse_release_verdict(leader_result.calldata)
                independent = _parse_release_verdict(
                    _adjudicate_release(escrow, milestone, amount, evidence_sources)
                )
            except Exception:
                return False
            return (
                proposed.decision == independent.decision
                and proposed.scope_match == independent.scope_match
                and proposed.evidence_complete == independent.evidence_complete
                and proposed.tests_passed == independent.tests_passed
                and proposed.budget_ok == independent.budget_ok
                and proposed.evidence_bundle_hash == independent.evidence_bundle_hash
                and proposed.adjudication_context_hash == independent.adjudication_context_hash
                and proposed.snapshot_commitments_json == independent.snapshot_commitments_json
                and abs(int(proposed.confidence) - int(independent.confidence)) <= 15
            )

        verdict = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))
        release_id = _release_id(escrow_id, milestone, amount, verdict["evidence_bundle_hash"])
        if len(self.releases.get(release_id, "")) > 0:
            raise Exception("release_already_reviewed")

        approved = (
            verdict["decision"] == "approved"
            and verdict["scope_match"] is True
            and verdict["evidence_complete"] is True
            and verdict["tests_passed"] is True
            and verdict["budget_ok"] is True
        )
        release_record = {
            "schema_version": "escrowguard.release.v2",
            "release_id": release_id,
            "escrow_id": escrow_id,
            "requester": requester,
            "milestone_key": milestone,
            "requested_amount": amount,
            "authorized_amount": amount if approved else 0,
            "state": "approved" if approved else "blocked",
            "source_manifest": evidence_sources,
            "baseline_hash": escrow["baseline"]["baseline_hash"],
            "adjudication_context_hash": verdict["adjudication_context_hash"],
            "evidence_bundle_hash": verdict["evidence_bundle_hash"],
            "snapshot_commitments": verdict["snapshot_commitments"],
            "consensus_result": verdict,
            "execution_ready": approved,
        }
        escrow["release_ids"].append(release_id)
        self.releases[release_id] = _canonical_json(release_record)
        self.escrows[escrow_id] = _canonical_json(escrow)
        self.release_ids.append(release_id)
        self.latest_release_id = release_id
        return release_id

    @gl.public.write
    def execute_release(self, escrow_id: str, release_id: str) -> str:
        escrow = _load_json(self.escrows.get(escrow_id, ""), "escrow_not_found")
        release = _load_json(self.releases.get(release_id, ""), "release_not_found")
        if release["escrow_id"] != escrow_id:
            raise Exception("release_not_bound_to_escrow")
        if release["state"] != "approved" or release["execution_ready"] is not True:
            raise Exception("release_requires_approving_receipt")
        if len(self.executions.get(release_id, "")) > 0:
            raise Exception("release_already_executed")
        amount = int(release["authorized_amount"])
        if amount <= 0 or amount > int(escrow["remaining_budget"]):
            raise Exception("execution_exceeds_spending_boundary")
        if amount > int(escrow["deposited_value"]) - int(escrow["released_value"]):
            raise Exception("execution_exceeds_funded_balance")

        escrow["remaining_budget"] = int(escrow["remaining_budget"]) - amount
        escrow["released_value"] = int(escrow["released_value"]) + amount
        claim_key = _claim_key(escrow["payee"], escrow["currency"])
        existing_claim = self.payee_claims.get(claim_key, "")
        claim = (
            json.loads(existing_claim)
            if len(existing_claim) > 0
            else {
                "schema_version": "escrowguard.payee_claim.v1",
                "payee": escrow["payee"],
                "currency": escrow["currency"],
                "claimable_amount": 0,
                "release_ids": [],
            }
        )
        claim["claimable_amount"] = int(claim["claimable_amount"]) + amount
        claim["release_ids"].append(release_id)
        execution = {
            "schema_version": "escrowguard.execution.v2",
            "release_id": release_id,
            "escrow_id": escrow_id,
            "executed_by": str(gl.message.sender_address).lower(),
            "payer": escrow["payer"],
            "payee": escrow["payee"],
            "currency": escrow["currency"],
            "executed_amount": amount,
            "remaining_budget": escrow["remaining_budget"],
            "released_value": escrow["released_value"],
            "payee_claimable_amount": claim["claimable_amount"],
            "transfer_mechanism": "contract_state_credit_to_payee",
            "authorization_receipt_hash": _sha256(_canonical_json(release)),
            "status": "executed",
        }
        release["state"] = "executed"
        release["execution_ready"] = False
        self.executions[release_id] = _canonical_json(execution)
        self.releases[release_id] = _canonical_json(release)
        self.escrows[escrow_id] = _canonical_json(escrow)
        self.payee_claims[claim_key] = _canonical_json(claim)
        return _sha256(_canonical_json(execution))[:24]


def _commit_escrow_baseline(
    title: str,
    payer: str,
    payee: str,
    currency: str,
    budget: int,
    sources: typing.Sequence[dict],
) -> str:
    snapshots = _render_sources(sources)
    snapshot_commitments = _snapshot_commitments(sources, snapshots)
    review_materials = _baseline_review_materials(snapshots)
    baseline = {
        "project_title": title,
        "payer": payer,
        "payee": payee,
        "currency": currency,
        "total_budget": budget,
        "snapshot_commitments": snapshot_commitments,
        "review_materials": review_materials,
    }
    return _canonical_json(
        {
            "payer": payer,
            "payee": payee,
            "snapshot_commitments": snapshot_commitments,
            "review_materials": review_materials,
            "source_bundle_hash": _sha256(_canonical_json(sources)),
            "baseline_hash": _sha256(_canonical_json(baseline)),
        }
    )


def _adjudicate_release(
    escrow: dict,
    milestone: str,
    amount: int,
    evidence_sources: typing.Sequence[dict],
) -> str:
    snapshots = _render_sources(evidence_sources)
    snapshot_commitments = _snapshot_commitments(evidence_sources, snapshots)
    evidence_bundle_hash = _sha256(_canonical_json(snapshot_commitments))
    adjudication_context = {
        "baseline_hash": escrow["baseline"]["baseline_hash"],
        "milestone_terms": escrow["baseline"]["review_materials"]["milestone_terms"],
        "acceptance_policy": escrow["baseline"]["review_materials"]["acceptance_policy"],
        "release_snapshot_commitments": snapshot_commitments,
    }
    adjudication_context_hash = _sha256(_canonical_json(adjudication_context))
    prompt_payload = {
        "escrow": {
            "project_title": escrow["project_title"],
            "currency": escrow["currency"],
            "total_budget": escrow["total_budget"],
            "deposited_value": escrow["deposited_value"],
            "remaining_budget": escrow["remaining_budget"],
            "released_value": escrow["released_value"],
            "baseline_hash": escrow["baseline"]["baseline_hash"],
            "baseline_commitments": escrow["baseline"]["snapshot_commitments"],
            "milestone_terms_snapshot": escrow["baseline"]["review_materials"]["milestone_terms"],
            "acceptance_policy_snapshot": escrow["baseline"]["review_materials"]["acceptance_policy"],
        },
        "milestone_key": milestone,
        "requested_amount": amount,
        "evidence_snapshots": snapshots,
        "evidence_bundle_hash": evidence_bundle_hash,
        "adjudication_context_hash": adjudication_context_hash,
    }
    prompt = f"""
You are a GenLayer validator reviewing a milestone escrow release.

Return only minified JSON with keys decision, confidence, scope_match,
evidence_complete, tests_passed, budget_ok, summary, evidence_bundle_hash.

Input:
{_canonical_json(prompt_payload)}

Rules:
- decision must be "approved", "blocked", or "needs_review".
- Compare the release evidence to the fetched milestone terms and fetched acceptance policy from escrow creation.
- Do not approve unless the evidence directly supports the milestone, the submitted tests pass or clearly document acceptance, and the requested amount is within both remaining budget and deposited value.
- Use blocked for contradiction or failing evidence.
- Use needs_review for thin, inaccessible, or ambiguous evidence.
- evidence_bundle_hash must be exactly "{evidence_bundle_hash}".
"""
    data = json.loads(gl.nondet.exec_prompt(prompt))
    normalized = {
        "decision": str(data["decision"]).lower(),
        "confidence": max(0, min(100, int(data["confidence"]))),
        "scope_match": bool(data["scope_match"]),
        "evidence_complete": bool(data["evidence_complete"]),
        "tests_passed": bool(data["tests_passed"]),
        "budget_ok": bool(data["budget_ok"]) and amount <= int(escrow["remaining_budget"]),
        "summary": str(data["summary"])[:500],
        "evidence_bundle_hash": str(data["evidence_bundle_hash"]),
        "adjudication_context_hash": adjudication_context_hash,
        "snapshot_commitments": snapshot_commitments,
    }
    return _canonical_json(normalized)


def _parse_release_verdict(raw_json: str) -> ReleaseVerdict:
    data = json.loads(raw_json)
    decision = str(data["decision"]).lower()
    confidence = int(data["confidence"])
    evidence_bundle_hash = str(data["evidence_bundle_hash"])
    adjudication_context_hash = str(data["adjudication_context_hash"])
    snapshot_commitments_json = _canonical_json(data["snapshot_commitments"])
    summary = str(data["summary"])
    if decision not in ("approved", "blocked", "needs_review"):
        raise Exception("invalid_decision")
    if confidence < 0 or confidence > 100:
        raise Exception("invalid_confidence")
    if len(evidence_bundle_hash) != 64:
        raise Exception("invalid_evidence_bundle_hash")
    if len(adjudication_context_hash) != 64:
        raise Exception("invalid_adjudication_context_hash")
    if len(data["snapshot_commitments"]) != 3:
        raise Exception("invalid_snapshot_commitments")
    if len(summary) == 0 or len(summary) > 500:
        raise Exception("invalid_summary")
    return ReleaseVerdict(
        decision=decision,
        confidence=u8(confidence),
        scope_match=bool(data["scope_match"]),
        evidence_complete=bool(data["evidence_complete"]),
        tests_passed=bool(data["tests_passed"]),
        budget_ok=bool(data["budget_ok"]),
        evidence_bundle_hash=evidence_bundle_hash,
        adjudication_context_hash=adjudication_context_hash,
        snapshot_commitments_json=snapshot_commitments_json,
        summary=summary,
    )


def _render_sources(sources: typing.Sequence[dict]) -> typing.Sequence[dict]:
    snapshots = []
    for source in sources:
        rendered_text = gl.nondet.web.render(source["canonical_url"], mode="text")[:6000]
        snapshots.append(
            {
                "source_index": source["source_index"],
                "source_type": source["source_type"],
                "canonical_url": source["canonical_url"],
                "url_hash": source["url_hash"],
                "snapshot_hash": _sha256(rendered_text),
                "snapshot_chars": len(rendered_text),
                "text": rendered_text,
            }
        )
    return snapshots


def _snapshot_commitments(
    sources: typing.Sequence[dict],
    snapshots: typing.Sequence[dict],
) -> typing.Sequence[dict]:
    commitments = []
    for source, snapshot in zip(sources, snapshots):
        commitments.append(
            {
                "source_index": source["source_index"],
                "source_type": source["source_type"],
                "host": source["host"],
                "canonical_url": source["canonical_url"],
                "url_hash": source["url_hash"],
                "snapshot_hash": snapshot["snapshot_hash"],
                "snapshot_chars": snapshot["snapshot_chars"],
            }
        )
    return commitments


def _baseline_review_materials(snapshots: typing.Sequence[dict]) -> dict:
    materials = {}
    for snapshot in snapshots:
        source_type = snapshot["source_type"]
        if source_type in ("milestone_terms", "acceptance_policy"):
            materials[source_type] = {
                "canonical_url": snapshot["canonical_url"],
                "snapshot_hash": snapshot["snapshot_hash"],
                "snapshot_excerpt": str(snapshot["text"])[:1600],
            }
    if "milestone_terms" not in materials or "acceptance_policy" not in materials:
        raise Exception("baseline_review_materials_incomplete")
    return materials


def _escrow_sources(terms_url: str, repository_url: str, policy_url: str) -> typing.Sequence[dict]:
    return [
        _manifest_entry(1, "milestone_terms", terms_url),
        _manifest_entry(2, "work_repository", repository_url),
        _manifest_entry(3, "acceptance_policy", policy_url),
    ]


def _release_sources(deliverable_url: str, evidence_url: str, test_url: str) -> typing.Sequence[dict]:
    return [
        _manifest_entry(1, "deliverable", deliverable_url),
        _manifest_entry(2, "evidence_pack", evidence_url),
        _manifest_entry(3, "test_report", test_url),
    ]


def _manifest_entry(index: int, source_type: str, raw_url: str) -> dict:
    host, parts = _url_parts(raw_url)
    return {
        "source_index": index,
        "source_type": source_type,
        "host": host,
        "canonical_url": "https://" + host + "/" + "/".join(parts),
        "url_hash": _sha256("https://" + host + "/" + "/".join(parts)),
    }


def _url_parts(raw_url: str) -> typing.Tuple[str, typing.Sequence[str]]:
    url = str(raw_url).strip()
    if not url.startswith("https://") or len(url) > 600:
        raise Exception("sources_must_use_canonical_https")
    if "?" in url or "#" in url:
        raise Exception("sources_must_not_include_query_or_fragment")
    without_scheme = url[8:]
    if "/" not in without_scheme:
        raise Exception("source_path_required")
    host, path = without_scheme.split("/", 1)
    parts = [part for part in path.split("/") if len(part) > 0]
    if len(parts) == 0:
        raise Exception("source_path_required")
    return host.lower(), parts


def _load_json(raw: str, missing_error: str) -> dict:
    if len(raw) == 0:
        raise Exception(missing_error)
    return json.loads(raw)


def _clean_text(value: str, max_length: int, error: str) -> str:
    clean = " ".join(str(value).strip().split())
    if len(clean) == 0 or len(clean) > max_length:
        raise Exception(error)
    return clean


def _canonical_wallet(value: str) -> str:
    wallet = str(value).strip().lower()
    if not wallet.startswith("0x") or len(wallet) != 42:
        raise Exception("invalid_wallet")
    return wallet


def _parse_positive_amount(value: str, error: str) -> int:
    amount = int(str(value).strip())
    if amount <= 0:
        raise Exception(error)
    return amount


def _escrow_id(payer: str, payee: str, title: str, baseline_hash: str) -> str:
    return "esc_" + _sha256(payer + "|" + payee + "|" + title.lower() + "|" + baseline_hash)[:20]


def _release_id(escrow_id: str, milestone: str, amount: int, evidence_hash: str) -> str:
    return "pay_" + _sha256(escrow_id + "|" + milestone.lower() + "|" + str(amount) + "|" + evidence_hash)[:20]


def _claim_key(payee: str, currency: str) -> str:
    return _sha256(payee + "|" + currency.upper())


def _canonical_json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
