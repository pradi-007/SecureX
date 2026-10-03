"""Tests for dvrx.core.custody module, specifically proving tamper detection."""

import json
from pathlib import Path
import pytest

from dvrx.core.custody import (
    GENESIS_PREV_HASH,
    CustodyEntry,
    CustodyLog,
    compute_canonical_hash,
    verify_custody_log,
)
from dvrx.core.time_utils import get_current_forensic_timestamp


def test_custody_log_creation_and_chaining(tmp_path: Path):
    """Test standard append operations and cryptographic chaining."""
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    # 1. Genesis entry
    entry1 = log.append(
        examiner="Alice Smith",
        action="CASE_CREATED",
        details={"case_id": "CASE-100"},
    )
    assert entry1.entry_id == 1
    assert entry1.prev_hash == GENESIS_PREV_HASH
    assert entry1.examiner == "Alice Smith"
    assert entry1.action == "CASE_CREATED"
    assert len(entry1.entry_hash) == 64

    # 2. Second entry
    entry2 = log.append(
        examiner="Alice Smith",
        action="EVIDENCE_ACQUIRED",
        file_hash={"md5": "d41d8cd98f00b204e9800998ecf8427e", "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
        details={"evidence_id": "EVD-001"},
    )
    assert entry2.entry_id == 2
    assert entry2.prev_hash == entry1.entry_hash

    # 3. Third entry
    entry3 = log.append(
        examiner="Bob Jones",
        action="CASE_VERIFIED",
        details={"status": "PASSED"},
    )
    assert entry3.entry_id == 3
    assert entry3.prev_hash == entry2.entry_hash

    # Verification on pristine log
    res = log.verify()
    assert res.is_valid is True
    assert res.entry_count == 3
    assert len(res.errors) == 0


def test_tamper_detection_modified_action(tmp_path: Path):
    """PROVE TAMPERING IS DETECTED: Changing an action string invalidates the chain."""
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    log.append(examiner="Alice", action="CASE_CREATED")
    log.append(examiner="Alice", action="EVIDENCE_ACQUIRED", file_hash={"sha256": "abc123"})
    log.append(examiner="Alice", action="CASE_VERIFIED")

    # Tamper with entry #2: change action to "EVIDENCE_DESTROYED"
    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    data2 = json.loads(lines[1])
    data2["action"] = "EVIDENCE_DESTROYED"  # Malicious modification
    lines[1] = json.dumps(data2)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    verification = verify_custody_log(log_path)
    assert verification.is_valid is False
    assert any("Entry #2 content tampered" in err for err in verification.errors)


def test_tamper_detection_modified_examiner(tmp_path: Path):
    """PROVE TAMPERING IS DETECTED: Changing examiner name invalidates the chain."""
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    log.append(examiner="Forensic Examiner A", action="CASE_CREATED")
    log.append(examiner="Forensic Examiner A", action="EVIDENCE_ACQUIRED")

    # Modify line 1 examiner name
    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    data1 = json.loads(lines[0])
    data1["examiner"] = "Unauthorized Person"
    lines[0] = json.dumps(data1)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    verification = verify_custody_log(log_path)
    assert verification.is_valid is False
    assert any("Entry #1 content tampered" in err for err in verification.errors)


def test_tamper_detection_modified_timestamp(tmp_path: Path):
    """PROVE TAMPERING IS DETECTED: Falsifying a timestamp is detected."""
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    log.append(examiner="Alice", action="CASE_CREATED")
    log.append(examiner="Alice", action="EVIDENCE_ACQUIRED")

    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    data = json.loads(lines[0])
    data["timestamp_utc"] = "1999-01-01T00:00:00Z"  # Backdated timestamp
    lines[0] = json.dumps(data)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    verification = verify_custody_log(log_path)
    assert verification.is_valid is False
    assert any("Entry #1 content tampered" in err for err in verification.errors)


def test_tamper_detection_modified_file_hash(tmp_path: Path):
    """PROVE TAMPERING IS DETECTED: Modifying registered evidence file hash is detected."""
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    log.append(examiner="Alice", action="CASE_CREATED")
    log.append(
        examiner="Alice",
        action="EVIDENCE_ACQUIRED",
        file_hash={"sha256": "1111111111111111111111111111111111111111111111111111111111111111"},
    )

    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    data = json.loads(lines[1])
    data["file_hash"]["sha256"] = "9999999999999999999999999999999999999999999999999999999999999999"
    lines[1] = json.dumps(data)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    verification = verify_custody_log(log_path)
    assert verification.is_valid is False
    assert any("Entry #2 content tampered" in err for err in verification.errors)


def test_tamper_detection_deleted_entry(tmp_path: Path):
    """PROVE TAMPERING IS DETECTED: Deleting an entry in the middle breaks the chain."""
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    log.append(examiner="Alice", action="CASE_CREATED")
    log.append(examiner="Alice", action="EVIDENCE_ACQUIRED_1")
    log.append(examiner="Alice", action="EVIDENCE_ACQUIRED_2")
    log.append(examiner="Alice", action="CASE_VERIFIED")

    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    # Delete entry #2
    lines.pop(1)
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    verification = verify_custody_log(log_path)
    assert verification.is_valid is False
    # Will detect ID mismatch or prev_hash mismatch
    assert len(verification.errors) > 0


def test_tamper_detection_recomputed_hash_chain_tamper(tmp_path: Path):
    """PROVE TAMPERING IS DETECTED: If attacker modifies entry 1 and recalculates entry 1's hash,
    entry 2's prev_hash will mismatch unless all subsequent entries are forged.
    Even then, genesis checks and audit trails catch it.
    """
    log_path = tmp_path / "custody.jsonl"
    log = CustodyLog(log_path)

    log.append(examiner="Alice", action="CASE_CREATED")
    log.append(examiner="Alice", action="EVIDENCE_ACQUIRED")

    lines = log_path.read_text(encoding="utf-8").strip().splitlines()
    data1 = json.loads(lines[0])
    data1["examiner"] = "Eve"
    # Attacker recalculates entry 1 hash
    forged_hash = compute_canonical_hash(CustodyEntry.from_dict(data1).payload_dict())
    data1["entry_hash"] = forged_hash
    lines[0] = json.dumps(data1)
    # But entry 2 still has Alice's entry 1 hash as prev_hash!
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    verification = verify_custody_log(log_path)
    assert verification.is_valid is False
    assert any("prev_hash mismatch" in err for err in verification.errors)
