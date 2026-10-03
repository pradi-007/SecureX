"""Tests for DVRX Web API Bridge.

Validates all JSON bridge endpoints used by the Next.js frontend:
- list_cases
- get_case
- create_case
- acquire_evidence
- verify_case
- inspect_evidence (hex dump, container parsing, NAL unit detection, Section 65B certification)
"""

from pathlib import Path
import pytest

from dvrx.web_api import (
    acquire_evidence,
    create_case,
    get_case,
    inspect_evidence,
    list_cases,
    verify_case,
)


@pytest.fixture
def temp_cases_dir(tmp_path: Path) -> Path:
    cases_dir = tmp_path / "cases"
    cases_dir.mkdir(parents=True, exist_ok=True)
    return cases_dir


@pytest.fixture
def sample_video_stream(tmp_path: Path) -> Path:
    video_path = tmp_path / "test_stream.raw"
    # Create sample bitstream with container text and H.264 Annex B start codes
    container_header = (
        b"DVRX_FORENSIC_STREAM_CONTAINER_V1\n"
        b"JURISDICTION: New Delhi, India\n"
        b"CAMERA_NODE: CAM-04-NORTH-GATE\n"
        b"FORMAT: H264_RAW_ANNEX_B\n"
        b"---BEGIN_RAW_STREAM_BLOCK---\n"
    )
    # SPS (0x67), PPS (0x68), IDR (0x65), non-IDR (0x61)
    nal_sps = b"\x00\x00\x00\x01\x67\x42\x00\x1e"
    nal_pps = b"\x00\x00\x00\x01\x68\xce\x3c\x80"
    nal_idr = b"\x00\x00\x00\x01\x65\x88\x84\x00"
    nal_slice = b"\x00\x00\x01\x61\x9a\x01\x02"

    content = container_header + nal_sps + nal_pps + nal_idr + nal_slice
    content += b"\x00" * (1024 - len(content))
    video_path.write_bytes(content)
    return video_path


def test_web_api_lifecycle(temp_cases_dir: Path, sample_video_stream: Path):
    # 1. Create Case
    res_create = create_case("CASE-WEB-001", "Examiner Arjun", "Web API test case", str(temp_cases_dir))
    assert res_create["status"] == "ok"
    assert res_create["case"]["case_id"] == "CASE-WEB-001"
    assert res_create["case"]["examiner"] == "Examiner Arjun"

    # 2. List Cases
    res_list = list_cases(str(temp_cases_dir))
    assert res_list["status"] == "ok"
    assert len(res_list["cases"]) == 1
    assert res_list["cases"][0]["case_id"] == "CASE-WEB-001"

    # 3. Acquire Evidence
    res_acq = acquire_evidence(
        "CASE-WEB-001",
        str(sample_video_stream),
        examiner="Examiner Arjun",
        notes="Ingested CCTV raw feed",
        cases_dir=str(temp_cases_dir),
    )
    assert res_acq["status"] == "ok"
    assert res_acq["evidence"]["evidence_id"] == "EVD-001"
    assert res_acq["evidence"]["file_size"] == 1024
    assert res_acq["evidence"]["sha256"] != ""

    # 4. Get Case Details
    res_get = get_case("CASE-WEB-001", str(temp_cases_dir))
    assert res_get["status"] == "ok"
    assert len(res_get["evidence"]) == 1
    assert res_get["custody"]["is_valid"] is True
    assert res_get["custody"]["entry_count"] >= 2  # Genesis + Acquire

    # 5. Inspect Evidence
    res_insp = inspect_evidence("CASE-WEB-001", "EVD-001", str(temp_cases_dir))
    assert res_insp["status"] == "ok"
    assert res_insp["exists_on_disk"] is True
    assert len(res_insp["hex_dump"]) == 32  # 512 bytes / 16 bytes = 32 rows
    assert res_insp["hex_dump"][0]["offset"] == "00000000"
    assert "DVRX_FORENSIC_STREAM" in res_insp["text_header"]
    assert len(res_insp["nal_units"]) >= 3  # SPS, PPS, IDR, Slice detected

    # Verify Section 65B Certificate structure
    cert = res_insp["certificate_65b"]
    assert cert["case_id"] == "CASE-WEB-001"
    assert cert["evidence_id"] == "EVD-001"
    assert cert["sha256"] == res_acq["evidence"]["sha256"]
    assert "SECTION 65B" in cert["title"]
    assert "device_certification" in cert

    # 6. Verify Case
    res_verify = verify_case("CASE-WEB-001", examiner="Examiner Arjun", cases_dir=str(temp_cases_dir))
    assert res_verify["status"] == "ok"
    assert res_verify["report"]["overall_valid"] is True
    assert res_verify["report"]["evidence_verified_count"] == 1
    assert res_verify["report"]["evidence_failed_count"] == 0


def test_web_api_inspect_missing_evidence(temp_cases_dir: Path):
    create_case("CASE-EMPTY", "Examiner Rao", "", str(temp_cases_dir))
    with pytest.raises(ValueError, match="Evidence 'EVD-999' not found"):
        inspect_evidence("CASE-EMPTY", "EVD-999", str(temp_cases_dir))
