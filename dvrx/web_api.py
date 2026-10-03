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
        else:
            res = {"status": "error", "message": f"Unknown command: {cmd}"}
        print(json.dumps(res))
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
