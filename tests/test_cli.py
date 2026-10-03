"""Tests for dvrx CLI commands."""

from pathlib import Path
import pytest

from dvrx.cli import main


def test_cli_case_new_and_verify(tmp_path: Path, capsys):
    """Test full CLI lifecycle: case new -> acquire -> case verify."""
    cases_dir = str(tmp_path / "cases")

    # 1. dvrx case new
    ret_new = main([
        "case", "new",
        "--id", "CASE-CLI-01",
        "--examiner", "Det. Miller",
        "--notes", "Seized DVR from convenience store",
        "--cases-dir", cases_dir,
    ])
    assert ret_new == 0
    captured = capsys.readouterr()
    assert "CASE CREATED" in captured.out
    assert "CASE-CLI-01" in captured.out

    # 2. Create synthetic evidence file
    evidence_file = tmp_path / "nvr_dump.dd"
    evidence_file.write_bytes(b"SYNTHETIC_CCTV_RECORDING_BLOCK_001" * 50)

    # 3. dvrx acquire
    ret_acq = main([
        "acquire",
        "--case", "CASE-CLI-01",
        "--source", str(evidence_file),
        "--notes", "Hard disk channel 1",
        "--cases-dir", cases_dir,
    ])
    assert ret_acq == 0
    captured = capsys.readouterr()
    assert "EVIDENCE ACQUIRED (READ-ONLY)" in captured.out
    assert "SHA-256 Hash:" in captured.out

    # 4. dvrx case verify (pristine)
    ret_ver = main([
        "case", "verify",
        "--case", "CASE-CLI-01",
        "--cases-dir", cases_dir,
    ])
    assert ret_ver == 0
    captured = capsys.readouterr()
    assert "OVERALL VERDICT: PASSED" in captured.out
    assert "VERIFIED_MATCH" in captured.out

    # 5. Tamper evidence and verify failure
    evidence_file.write_bytes(b"TAMPERED_CCTV_RECORDING_BLOCK_999" * 50)
    ret_ver_tampered = main([
        "case", "verify",
        "--case", "CASE-CLI-01",
        "--cases-dir", cases_dir,
    ])
    assert ret_ver_tampered == 1
    captured_tampered = capsys.readouterr()
    assert "OVERALL VERDICT: FAILED" in captured_tampered.out
    assert "HASH_MISMATCH" in captured_tampered.out


def test_cli_acquire_missing_source(tmp_path: Path, capsys):
    """Test CLI error handling on non-existent source file."""
    cases_dir = str(tmp_path / "cases")
    ret = main([
        "acquire",
        "--case", "CASE-NONEXISTENT",
        "--source", str(tmp_path / "does_not_exist.raw"),
        "--cases-dir", cases_dir,
    ])
    assert ret == 1
    captured = capsys.readouterr()
    assert "not found" in captured.err
