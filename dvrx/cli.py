"""CLI entry point for DVRX forensic analysis tool.

Commands:
  dvrx case new --id <ID> --examiner <NAME>
  dvrx case verify --case <ID>
  dvrx acquire --case <ID> --source <file>
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
from typing import List, Optional

from dvrx import __version__
from dvrx.core.case import CaseManager, VerificationReport


def create_cli_progress_callback(desc: str = "Hashing") -> callable:
    """Create a terminal-friendly progress callback."""
    is_tty = sys.stderr.isatty()
    last_pct = [-1]

    def callback(bytes_read: int, total_bytes: int) -> None:
        if total_bytes <= 0:
            return
        pct = int((bytes_read / total_bytes) * 100)
        # Update on TTY every 1% or at completion
        if is_tty:
            bar_len = 30
            filled = int(bar_len * (bytes_read / total_bytes))
            bar = "=" * filled + (">" if filled < bar_len else "")
            bar = bar.ljust(bar_len, " ")
            mb_read = bytes_read / (1024 * 1024)
            mb_total = total_bytes / (1024 * 1024)
            sys.stderr.write(f"\r{desc}: [{bar}] {pct:3d}% ({mb_read:.2f} MB / {mb_total:.2f} MB)")
            sys.stderr.flush()
            if bytes_read >= total_bytes:
                sys.stderr.write("\n")
                sys.stderr.flush()
        else:
            # Non-interactive / piped output: log at intervals
            if pct != last_pct[0] and pct in (0, 25, 50, 75, 100):
                last_pct[0] = pct
                print(f"{desc}: {pct}% ({bytes_read} / {total_bytes} bytes)", file=sys.stderr)

    return callback


def handle_case_new(args: argparse.Namespace) -> int:
    """Handle 'dvrx case new' command."""
    manager = CaseManager(base_cases_dir=args.cases_dir)
    try:
        case = manager.create_case(
            case_id=args.id,
            examiner=args.examiner,
            notes=args.notes or "",
        )
        print("=" * 60)
        print("  DVRX - CASE CREATED")
        print("=" * 60)
        print(f"  Case ID:       {case.case_id}")
        print(f"  Examiner:      {case.examiner}")
        print(f"  Created (UTC): {case.created_utc}")
        print(f"  Created (Raw): {case.created_raw} ({case.tz_offset})")
        print(f"  Case Directory:{case.case_dir}")
        if case.notes:
            print(f"  Notes:         {case.notes}")
        print("  Custody Log:   Initialized with Genesis Entry (Chain of Custody Active)")
        print("=" * 60)
        return 0
    except Exception as exc:
        print(f"Error creating case '{args.id}': {exc}", file=sys.stderr)
        return 1


def handle_acquire(args: argparse.Namespace) -> int:
    """Handle 'dvrx acquire' command."""
    manager = CaseManager(base_cases_dir=args.cases_dir)
    source_path = Path(args.source)
    if not source_path.exists():
        print(f"Error: Source evidence file not found: {source_path}", file=sys.stderr)
        return 1

    try:
        progress_cb = create_cli_progress_callback(desc=f"Acquiring {source_path.name}")
        evidence = manager.acquire_evidence(
            case_id=args.case,
            source_path=source_path,
            examiner=args.examiner,
            evidence_id=args.evidence_id,
            notes=args.notes or "",
            progress_callback=progress_cb,
        )

        print("\n" + "=" * 60)
        print("  DVRX - EVIDENCE ACQUIRED (READ-ONLY)")
        print("=" * 60)
        print(f"  Evidence ID:   {evidence.evidence_id}")
        print(f"  Case ID:       {evidence.case_id}")
        print(f"  Source Path:   {evidence.source_path}")
        print(f"  File Size:     {evidence.file_size:,} bytes")
        print(f"  MD5 Hash:      {evidence.md5}")
        print(f"  SHA-256 Hash:  {evidence.sha256}")
        print(f"  Acquired (UTC):{evidence.acquired_utc}")
        print(f"  Acquired (Raw):{evidence.acquired_raw} ({evidence.tz_offset})")
        print(f"  Examiner:      {evidence.examiner}")
        print("  Custody Log:   Appended action EVIDENCE_ACQUIRED to hash chain")
        print("=" * 60)
        return 0
    except Exception as exc:
        print(f"Error acquiring evidence for case '{args.case}': {exc}", file=sys.stderr)
        return 1


def handle_case_verify(args: argparse.Namespace) -> int:
    """Handle 'dvrx case verify' command."""
    manager = CaseManager(base_cases_dir=args.cases_dir)
    try:
        progress_cb = create_cli_progress_callback(desc="Re-hashing Evidence")
        report: VerificationReport = manager.verify_case(
            case_id=args.case,
            examiner=args.examiner,
            progress_callback=progress_cb,
        )

        print("\n" + "=" * 60)
        print(f"  DVRX - CASE VERIFICATION REPORT: {report.case_id}")
        print("=" * 60)

        # 1. Custody Chain Status
        custody_status = "VALID (Intact)" if report.custody_valid else "TAMPERED / BROKEN"
        print(f"\n[1] Chain of Custody Integrity: {custody_status}")
        print(f"    Total Custody Entries: {report.custody_entry_count}")
        if report.custody_errors:
            print("    Custody Errors Detected:")
            for err in report.custody_errors:
                print(f"      - [FAIL] {err}")
        else:
            print("    All custody entries cryptographically chained and intact.")

        # 2. Evidence Files Status
        print(f"\n[2] Evidence File Integrity: {report.evidence_verified_count}/{report.evidence_count} Passed")
        for ev in report.evidence_details:
            match_str = "[MATCH]" if ev.is_valid else "[FAIL]"
            print(f"    {match_str} {ev.evidence_id}: {ev.source_path}")
            print(f"           Status: {ev.status}")
            print(f"           Recorded SHA-256: {ev.recorded_sha256}")
            print(f"           Computed SHA-256: {ev.computed_sha256 or 'N/A'}")

        # 3. Overall Verdict
        print("\n" + "-" * 60)
        if report.overall_valid:
            print("  OVERALL VERDICT: PASSED - FORENSIC INTEGRITY CONFIRMED")
            exit_code = 0
        else:
            print("  OVERALL VERDICT: FAILED - INTEGRITY COMPROMISED / TAMPER DETECTED")
            exit_code = 1
        print("-" * 60 + "\n")
        return exit_code

    except Exception as exc:
        print(f"Error verifying case '{args.case}': {exc}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for DVRX CLI."""
    parser = argparse.ArgumentParser(
        prog="dvrx",
        description="DVRX: Vendor-Agnostic DVR/NVR Forensic Analysis Tool",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # Command: dvrx case ...
    case_parser = subparsers.add_parser("case", help="Case management and verification")
    case_subparsers = case_parser.add_subparsers(dest="case_command", help="Case actions")

    # Subcommand: dvrx case new
    case_new_parser = case_subparsers.add_parser("new", help="Create a new forensic case")
    case_new_parser.add_argument("--id", required=True, help="Unique Case Identifier (e.g. CASE-001)")
    case_new_parser.add_argument("--examiner", required=True, help="Lead Examiner Name / Identifier")
    case_new_parser.add_argument("--notes", default="", help="Optional case notes or case description")
    case_new_parser.add_argument("--cases-dir", default=None, help="Custom directory for case storage")

    # Subcommand: dvrx case verify
    case_verify_parser = case_subparsers.add_parser("verify", help="Verify custody chain and evidence hashes")
    case_verify_parser.add_argument("--case", required=True, help="Case Identifier to verify")
    case_verify_parser.add_argument("--examiner", default=None, help="Verifier Examiner Name")
    case_verify_parser.add_argument("--cases-dir", default=None, help="Custom directory for case storage")

    # Command: dvrx acquire ...
    acquire_parser = subparsers.add_parser("acquire", help="Acquire and hash evidence file (read-only)")
    acquire_parser.add_argument("--case", required=True, help="Case Identifier to add evidence to")
    acquire_parser.add_argument("--source", required=True, help="Path to evidence file or disk image")
    acquire_parser.add_argument("--examiner", default=None, help="Examiner performing acquisition")
    acquire_parser.add_argument("--id", dest="evidence_id", default=None, help="Optional Evidence Identifier (e.g. EVD-001)")
    acquire_parser.add_argument("--notes", default="", help="Optional notes on the evidence item")
    acquire_parser.add_argument("--cases-dir", default=None, help="Custom directory for case storage")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    """Main CLI execution router."""
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "case":
        if args.case_command == "new":
            return handle_case_new(args)
        elif args.case_command == "verify":
            return handle_case_verify(args)
        else:
            parser.parse_args(["case", "--help"])
            return 1
    elif args.command == "acquire":
        return handle_acquire(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
