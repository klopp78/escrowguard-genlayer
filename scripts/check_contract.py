import importlib.util
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "escrow_guard.py"
EXPECTED_DEPENDS = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"


class _Public:
    @staticmethod
    def view(fn):
        fn.__genlayer_visibility__ = "view"
        return fn

    @staticmethod
    def write(fn):
        fn.__genlayer_visibility__ = "write"
        return fn


class _Return:
    def __init__(self, calldata="{}"):
        self.calldata = calldata


class _VM:
    Return = _Return

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        return leader_fn()


class _Contract:
    pass


class _Message:
    sender_address = "0x1111111111111111111111111111111111111111"


class _GL:
    Contract = _Contract
    public = _Public()
    vm = _VM()
    message = _Message()


class _DynArray(list):
    pass


class _TreeMap(dict):
    pass


def _install_genlayer_stub():
    module = types.ModuleType("genlayer")
    module.gl = _GL()
    module.DynArray = _DynArray
    module.TreeMap = _TreeMap
    module.u64 = int
    module.u8 = int
    sys.modules["genlayer"] = module


def _load_contract_module():
    spec = importlib.util.spec_from_file_location("escrow_guard", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main():
    source = CONTRACT_PATH.read_text(encoding="utf-8")
    if EXPECTED_DEPENDS not in source.splitlines()[0]:
        raise SystemExit(f"missing pinned runtime dependency: {EXPECTED_DEPENDS}")

    _install_genlayer_stub()
    module = _load_contract_module()
    contract_cls = module.EscrowGuard
    if not issubclass(contract_cls, _Contract):
        raise SystemExit("EscrowGuard must inherit gl.Contract")

    required_methods = {
        "create_escrow": "write",
        "request_release": "write",
        "execute_release": "write",
        "get_escrow": "view",
        "get_release": "view",
        "get_execution": "view",
        "get_payee_claim": "view",
        "list_escrow_ids": "view",
        "list_release_ids": "view",
    }
    for method_name, visibility in required_methods.items():
        method = getattr(contract_cls, method_name, None)
        if method is None:
            raise SystemExit(f"missing method: {method_name}")
        actual = getattr(method, "__genlayer_visibility__", None)
        if actual != visibility:
            raise SystemExit(f"{method_name} must be public.{visibility}")

    sources = module._escrow_sources(
        "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/milestone-terms.md",
        "https://github.com/klopp78/escrowguard-genlayer",
        "https://github.com/klopp78/escrowguard-genlayer/blob/main/examples/acceptance-policy.md",
    )
    if [item["source_type"] for item in sources] != [
        "milestone_terms",
        "work_repository",
        "acceptance_policy",
    ]:
        raise SystemExit("escrow source manifest failed")

    escrow_id = module._escrow_id(
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        "Agent bounty milestone",
        "a" * 64,
    )
    release_id = module._release_id(escrow_id, "milestone-1", 250, "b" * 64)
    if not escrow_id.startswith("esc_") or len(escrow_id) != 24:
        raise SystemExit("escrow id format failed")
    if not release_id.startswith("pay_") or len(release_id) != 24:
        raise SystemExit("release id format failed")
    if "hashlib.sha256" not in source:
        raise SystemExit("missing SHA-256 hashing")
    if "release_requires_approving_receipt" not in source:
        raise SystemExit("execution receipt guard missing")
    if "execution_exceeds_spending_boundary" not in source:
        raise SystemExit("spending boundary guard missing")
    if "funded_value" not in source or "deposited_value" not in source:
        raise SystemExit("funded deposited value tracking missing")
    if "only_payer_or_payee_can_request_release_review" not in source:
        raise SystemExit("payee-requested review guard missing")
    if "only_payer_can_execute_release" in source:
        raise SystemExit("execution must not require payer cooperation after approval")
    if "contract_state_credit_to_payee" not in source:
        raise SystemExit("payee transfer ledger missing")
    if "milestone_terms_snapshot" not in source or "acceptance_policy_snapshot" not in source:
        raise SystemExit("baseline terms and policy must be passed into adjudication")

    print("EscrowGuard Python contract check passed")


if __name__ == "__main__":
    main()
