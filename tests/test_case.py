"""Tests for dvrx.core.case module."""

from pathlib import Path
import pytest

from dvrx.core.case import CaseManager


def test_create_case(tmp_path: Path):
    """Test creating a new forensic case."""
    manager = CaseManager(base_cases_dir=tmp_path)
    case_info = manager.create_case(
        case_id="CASE-2026-001",
        examiner="Special Agent Fox",
        notes="Surveillance DVR seized from scene",
    )

    assert case_info.case_id == "CASE-2026-001"
    assert case_info.examiner == "Special Agent Fox"
    assert case_info.notes == "Surveillance DVR seized from scene"
    assert Path(case_info.case_dir).exists()
    assert (Path(case_info.case_dir) / "case.db").exists()
    assert (Path(case_info.case_dir) / "custody.jsonl").exists()

    # Verify reload
    loaded = manager.load_case("CASE-2026-001")
    assert loaded.case_id == case_info.case_id
    assert loaded.examiner == case_info.examiner

    # Genesis custody entry exists
    custody = manager.get_custody_log("CASE-2026-001")
    assert len(custody.entries) == 1
    assert custody.entries[0].action == "CASE_CREATED"


def test_duplicate_case_id_rejected(tmp_path: Path):
    """Cannot create a case with an existing ID."""
    manager = CaseManager(base_cases_dir=tmp_path)
    manager.create_case(case_id="CASE-DUP", examiner="Agent A")
    with pytest.raises(FileExistsError):
        manager.create_case(case_id="CASE-DUP", examiner="Agent B")


def test_acquire_evidence(tmp_path: Path, synthetic_dvr_image: Path):
    """Acquiring evidence streams hashes, inserts database record, and logs to custody."""
    manager = CaseManager(base_cases_dir=tmp_path)
    manager.create_case(case_id="CASE-ACQ", examiner="Agent Scully")

    evidence = manager.acquire_evidence(
        case_id="CASE-ACQ",
        source_path=synthetic_dvr_image,
        notes="Primary HDD image from Hikvision NVR",
    )

    assert evidence.evidence_id == "EVD-001"
    assert evidence.case_id == "CASE-ACQ"
    assert evidence.file_size == synthetic_dvr_image.stat().st_size
    assert len(evidence.md5) == 32
    assert len(evidence.sha256) == 64
    assert evidence.examiner == "Agent Scully"

    # Listed in case evidence
    evidence_list = manager.list_evidence("CASE-ACQ")
    assert len(evidence_list) == 1
    assert evidence_list[0].evidence_id == "EVD-001"

    # Custody log has 2 entries now: CASE_CREATED, EVIDENCE_ACQUIRED
    custody = manager.get_custody_log("CASE-ACQ")
    assert len(custody.entries) == 2
    assert custody.entries[1].action == "EVIDENCE_ACQUIRED"
    assert custody.entries[1].file_hash["sha256"] == evidence.sha256


def test_case_verification_success(tmp_path: Path, synthetic_dvr_image: Path):
    """A pristine case with intact evidence passes full verification."""
    manager = CaseManager(base_cases_dir=tmp_path)
    manager.create_case(case_id="CASE-VERIFY-OK", examiner="Agent Mulder")
    manager.acquire_evidence(case_id="CASE-VERIFY-OK", source_path=synthetic_dvr_image)

    report = manager.verify_case(case_id="CASE-VERIFY-OK")

    assert report.overall_valid is True
    assert report.custody_valid is True
    assert report.evidence_count == 1
    assert report.evidence_verified_count == 1
    assert report.evidence_failed_count == 0
    assert report.evidence_details[0].status == "VERIFIED_MATCH"


def test_case_verification_fails_when_evidence_modified(tmp_path: Path):
    """If an evidence file has even 1 byte modified, verification fails."""
    manager = CaseManager(base_cases_dir=tmp_path)
    manager.create_case(case_id="CASE-CORRUPT", examiner="Agent Mulder")

    # Create synthetic evidence
    ev_file = tmp_path / "camera_feed.raw"
    ev_file.write_bytes(b"INITIAL_ORIGINAL_STREAMING_VIDEO_DATA_0000000000")

    manager.acquire_evidence(case_id="CASE-CORRUPT", source_path=ev_file)

    # TAMPER: Corrupt 1 byte in the source evidence file
    ev_file.write_bytes(b"INITIAL_ORIGINAL_STREAMING_VIDEO_DATA_0000000001")

    report = manager.verify_case(case_id="CASE-CORRUPT")

    assert report.overall_valid is False
    assert report.evidence_failed_count == 1
    assert report.evidence_details[0].is_valid is False
    assert report.evidence_details[0].status == "HASH_MISMATCH"


def test_case_verification_fails_when_evidence_missing(tmp_path: Path):
    """If an evidence file is missing/moved, verification reports failure."""
    manager = CaseManager(base_cases_dir=tmp_path)
    manager.create_case(case_id="CASE-MISSING", examiner="Agent Mulder")

    ev_file = tmp_path / "deleted_later.raw"
    ev_file.write_bytes(b"SOME_EVIDENCE_BYTES")

    manager.acquire_evidence(case_id="CASE-MISSING", source_path=ev_file)

    # Delete the evidence file
    ev_file.unlink()

    report = manager.verify_case(case_id="CASE-MISSING")

    assert report.overall_valid is False
    assert report.evidence_failed_count == 1
    assert report.evidence_details[0].status == "MISSING_FILE"


def test_case_verification_fails_when_custody_log_tampered(tmp_path: Path, synthetic_dvr_image: Path):
    """If custody log is tampered with, case verification reports failure."""
    manager = CaseManager(base_cases_dir=tmp_path)
    manager.create_case(case_id="CASE-CUSTODY-TAMPER", examiner="Agent Mulder")
    manager.acquire_evidence(case_id="CASE-CUSTODY-TAMPER", source_path=synthetic_dvr_image)

    # Maliciously alter custody log
    custody_file = tmp_path / "CASE-CUSTODY-TAMPER" / "custody.jsonl"
    text = custody_file.read_text(encoding="utf-8")
    tampered_text = text.replace("CASE_CREATED", "CASE_TAMPERED")
    custody_file.write_text(tampered_text, encoding="utf-8")

    report = manager.verify_case(case_id="CASE-CUSTODY-TAMPER")

    assert report.custody_valid is False
    assert report.overall_valid is False
    assert len(report.custody_errors) > 0
