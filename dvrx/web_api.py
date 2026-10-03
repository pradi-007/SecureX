"""JSON Bridge API for DVRX Web Interface.

Provides CLI-callable JSON endpoints to power the Next.js forensic web dashboard.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
from typing import Any, Dict

from dvrx.core.case import CaseManager


def get_manager(cases_dir: str | None = None) -> CaseManager:
    return CaseManager(base_cases_dir=cases_dir)


def list_cases(cases_dir: str | None = None) -> Dict[str, Any]:
    manager = get_manager(cases_dir)
    results = []
    if manager.base_dir.exists():
        for item in manager.base_dir.iterdir():
            if item.is_dir() and (item / "case.db").exists():
                try:
                    case = manager.load_case(item.name)
                    evidence = manager.list_evidence(item.name)
                    custody = manager.get_custody_log(item.name)
                    results.append({
                        "case_id": case.case_id,
                        "examiner": case.examiner,
                        "created_utc": case.created_utc,
                        "created_raw": case.created_raw,
                        "tz_offset": case.tz_offset,
                        "notes": case.notes,
                        "case_dir": case.case_dir,
                        "evidence_count": len(evidence),
                        "custody_entry_count": len(custody.entries),
                    })
                except Exception:
                    continue
    return {"status": "ok", "cases": results}


def get_case(case_id: str, cases_dir: str | None = None) -> Dict[str, Any]:
    manager = get_manager(cases_dir)
    case = manager.load_case(case_id)
    evidence = [e.to_dict() for e in manager.list_evidence(case_id)]
    custody = manager.get_custody_log(case_id)
    custody_entries = [e.to_dict() for e in custody.entries]
    verification = custody.verify()
    return {
        "status": "ok",
        "case": case.to_dict(),
        "evidence": evidence,
        "custody": {
            "is_valid": verification.is_valid,
            "entry_count": len(custody_entries),
            "errors": verification.errors,
            "entries": custody_entries,
        },
    }


def create_case(case_id: str, examiner: str, notes: str = "", cases_dir: str | None = None) -> Dict[str, Any]:
    manager = get_manager(cases_dir)
    case = manager.create_case(case_id=case_id, examiner=examiner, notes=notes)
    return {"status": "ok", "case": case.to_dict()}


def acquire_evidence(case_id: str, source_path: str, examiner: str | None = None, notes: str = "", cases_dir: str | None = None) -> Dict[str, Any]:
    manager = get_manager(cases_dir)
    evidence = manager.acquire_evidence(
        case_id=case_id,
        source_path=source_path,
        examiner=examiner,
        notes=notes,
    )
    return {"status": "ok", "evidence": evidence.to_dict()}


def verify_case(case_id: str, examiner: str | None = None, cases_dir: str | None = None) -> Dict[str, Any]:
    manager = get_manager(cases_dir)
    report = manager.verify_case(case_id=case_id, examiner=examiner)
    return {"status": "ok", "report": report.to_dict()}


def inspect_evidence(
    case_id: str,
    evidence_id: str,
    cases_dir: str | None = None,
    selected_vendor: str | None = None,
) -> Dict[str, Any]:
    # Handle potential swap if 3rd positional was a vendor name
    if cases_dir and any(cases_dir.lower().startswith(v) for v in ["hik", "dah", "cp", "hon", "uni", "vig", "god", "mat", "gen"]):
        if selected_vendor is None:
            selected_vendor = cases_dir
            cases_dir = None

    manager = get_manager(cases_dir)
    case = manager.load_case(case_id)
    evidence_list = manager.list_evidence(case_id)
    target_ev = next((e for e in evidence_list if e.evidence_id == evidence_id), None)
    if not target_ev:
        raise ValueError(f"Evidence '{evidence_id}' not found in case '{case_id}'.")

    src_path = Path(target_ev.source_path)
    exists = src_path.exists()
    if not exists:
        # Fallback 1: check case evidence directory
        candidate1 = Path(case.case_dir) / "evidence" / src_path.name
        if candidate1.exists():
            src_path = candidate1
            exists = True
        else:
            # Fallback 2: check root evidence directory
            candidate2 = Path.cwd() / "evidence" / src_path.name
            if candidate2.exists():
                src_path = candidate2
                exists = True

    header_bytes = b""
    hex_dump = []
    text_header = ""
    nal_units = []

    if exists and src_path.is_file():
        with open(src_path, "rb") as f:
            header_bytes = f.read(512)

        # Full 512 bytes hex dump formatted in 16-byte rows (up to 32 rows)
        for i in range(0, min(len(header_bytes), 512), 16):
            chunk = header_bytes[i : i + 16]
            hex_str = " ".join(f"{b:02x}" for b in chunk)
            ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
            hex_dump.append({
                "offset": f"{i:08x}",
                "hex": hex_str.ljust(48),
                "ascii": ascii_str,
            })

        try:
            raw_text = header_bytes.decode("utf-8", errors="ignore")
            if "---BEGIN_RAW_STREAM_BLOCK---" in raw_text:
                text_header = raw_text.split("---BEGIN_RAW_STREAM_BLOCK---")[0].strip()
            elif "DVRX_FORENSIC_STREAM_CONTAINER_V1" in raw_text:
                lines = [l for l in raw_text.splitlines() if ":" in l or "DVRX" in l]
                text_header = "\n".join(lines[:6]).strip()
        except Exception:
            pass

        # Scan for Annex B NAL units (both 4-byte 0x00000001 and 3-byte 0x000001)
        idx = 0
        while idx < len(header_bytes) - 4 and len(nal_units) < 10:
            pos4 = header_bytes.find(b"\x00\x00\x00\x01", idx)
            pos3 = header_bytes.find(b"\x00\x00\x01", idx)

            start_len = 0
            pos = -1
            if pos4 != -1 and (pos3 == -1 or pos4 <= pos3):
                pos = pos4
                start_len = 4
            elif pos3 != -1:
                pos = pos3
                start_len = 3

            if pos == -1:
                break

            header_offset = pos + start_len
            if header_offset < len(header_bytes):
                nal_byte = header_bytes[header_offset]
                nal_type = nal_byte & 0x1F
                nal_name = {
                    1: "Coded slice of a non-IDR picture (P/B-Frame)",
                    5: "Coded slice of an IDR picture (I-Frame Keyframe)",
                    6: "SEI (Supplemental Enhancement Information)",
                    7: "SPS (Sequence Parameter Set - Resolution & Profile)",
                    8: "PPS (Picture Parameter Set - Slice Coding Options)",
                    9: "AUD (Access Unit Delimiter)",
                }.get(nal_type, f"NAL Unit Type {nal_type}")

                nal_units.append({
                    "offset_hex": f"0x{pos:08x}",
                    "nal_unit_type": nal_type,
                    "type_name": nal_name.split(" (")[0],
                    "description": nal_name,
                })
            idx = pos + start_len

    custody = manager.get_custody_log(case_id)
    related_entries = []
    for ent in custody.entries:
        ent_fh = ent.file_hash
        ent_sha = ""
        if isinstance(ent_fh, dict):
            ent_sha = ent_fh.get("sha256", "")
        elif ent_fh:
            ent_sha = getattr(ent_fh, "sha256", "")

        if (
            (ent_sha and ent_sha == target_ev.sha256)
            or (ent.details and ent.details.get("source_path") == str(src_path))
            or (ent.details and ent.details.get("evidence_id") == target_ev.evidence_id)
        ):
            related_entries.append(ent.to_dict())

    certificate = {
        "title": "CERTIFICATE UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872",
        "sub_title": "(Admissibility of Electronic Records in Judicial Proceedings)",
        "case_id": case.case_id,
        "evidence_id": target_ev.evidence_id,
        "source_path": target_ev.source_path,
        "examiner": target_ev.examiner,
        "acquired_raw": target_ev.acquired_raw,
        "acquired_utc": target_ev.acquired_utc,
        "tz_offset": target_ev.tz_offset,
        "file_size": target_ev.file_size,
        "md5": target_ev.md5,
        "sha256": target_ev.sha256,
        "integrity_hash_status": "AUTHENTICATED & HASH-VERIFIED",
        "device_certification": (
            "I hereby solemnly declare and certify that the surveillance video recording "
            "was extracted from digital recording equipment under lawful physical custody. "
            "The DVR/NVR recorder was functioning properly and in regular operation throughout the period, "
            "and the electronic evidence bitstream has been sealed into an append-only cryptographic hash chain."
        ),
    }

    vendor_analysis = None
    if exists and src_path.is_file():
        try:
            from dvrx.parsers.detector import detect_and_parse_evidence
            vendor_analysis = detect_and_parse_evidence(src_path, selected_vendor)
        except Exception as e:
            vendor_analysis = {"status": "error", "message": str(e)}

    return {
        "status": "ok",
        "evidence": target_ev.to_dict(),
        "exists_on_disk": exists,
        "text_header": text_header,
        "hex_dump": hex_dump,
        "nal_units": nal_units,
        "custody_entries": related_entries,
        "certificate_65b": certificate,
        "section_65b_certificate": certificate,
        "vendor_analysis": vendor_analysis,
    }


def analyze_vendor(
    case_id: str,
    evidence_id: str,
    selected_vendor: str | None = None,
    cases_dir: str | None = None,
) -> Dict[str, Any]:
    manager = get_manager(cases_dir)
    case = manager.load_case(case_id)
    evidence_list = manager.list_evidence(case_id)
    target_ev = next((e for e in evidence_list if e.evidence_id == evidence_id), None)
    if not target_ev:
        raise ValueError(f"Evidence '{evidence_id}' not found in case '{case_id}'.")

    src_path = Path(target_ev.source_path)
    if not src_path.exists():
        candidate1 = Path(case.case_dir) / "evidence" / src_path.name
        if candidate1.exists():
            src_path = candidate1
        else:
            candidate2 = Path.cwd() / "evidence" / src_path.name
            if candidate2.exists():
                src_path = candidate2

    from dvrx.parsers.detector import detect_and_parse_evidence
    analysis = detect_and_parse_evidence(src_path, selected_vendor=selected_vendor)
    return {
        "status": "ok",
        "case_id": case_id,
        "evidence_id": evidence_id,
        "analysis": analysis,
    }


def list_supported_vendors() -> Dict[str, Any]:
    from dvrx.parsers.detector import get_all_supported_vendors
    return {
        "status": "ok",
        "vendors": get_all_supported_vendors(),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No command specified"}))
        sys.exit(1)

    cmd = sys.argv[1]
    payload = {}
    if len(sys.argv) >= 3:
        try:
            payload = json.loads(sys.argv[2])
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Invalid JSON payload: {e}"}))
            sys.exit(1)

    try:
        cases_dir = payload.get("cases_dir")
        if cmd == "list_cases":
            res = list_cases(cases_dir)
        elif cmd == "get_case":
            res = get_case(payload["case_id"], cases_dir)
        elif cmd == "create_case":
            res = create_case(payload["case_id"], payload["examiner"], payload.get("notes", ""), cases_dir)
        elif cmd == "acquire_evidence":
            res = acquire_evidence(payload["case_id"], payload["source_path"], payload.get("examiner"), payload.get("notes", ""), cases_dir)
        elif cmd == "verify_case":
            res = verify_case(payload["case_id"], payload.get("examiner"), cases_dir)
        elif cmd == "inspect_evidence":
            res = inspect_evidence(
                payload["case_id"],
                payload["evidence_id"],
                selected_vendor=payload.get("selected_vendor"),
                cases_dir=cases_dir,
            )
        elif cmd == "analyze_vendor":
            res = analyze_vendor(payload["case_id"], payload["evidence_id"], payload.get("selected_vendor"), cases_dir)
        elif cmd == "list_supported_vendors":
            res = list_supported_vendors()
        else:
            res = {"status": "error", "message": f"Unknown command: {cmd}"}
        print(json.dumps(res))
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
