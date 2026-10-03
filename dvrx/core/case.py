"""SQLite-backed Case Manager for DVRX.

Handles case creation, evidence registration, custody logging, and
cryptographic case re-verification.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import os
from pathlib import Path
import sqlite3
from typing import Any, Callable, Dict, List, Optional, Union

from dvrx.core.custody import CustodyEntry, CustodyLog, CustodyVerificationResult
from dvrx.core.hasher import HashResult, ProgressCallback, hash_file
from dvrx.core.time_utils import ForensicTimestamp, get_current_forensic_timestamp


@dataclass(frozen=True)
class CaseInfo:
    """Metadata for an investigation case."""

    case_id: str
    examiner: str
    created_utc: str
    created_raw: str
    tz_offset: str
    case_dir: str
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EvidenceRecord:
    """Forensic evidence registration record."""

    evidence_id: str
    case_id: str
    source_path: str
    file_size: int
    md5: str
    sha256: str
    acquired_utc: str
    acquired_raw: str
    tz_offset: str
    examiner: str
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EvidenceVerificationDetail:
    """Integrity check detail for a single evidence item."""

    evidence_id: str
    source_path: str
    is_valid: bool
    status: str
    recorded_md5: str
    computed_md5: Optional[str]
    recorded_sha256: str
    computed_sha256: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class VerificationReport:
    """Consolidated case verification report."""

    case_id: str
    overall_valid: bool
    custody_valid: bool
    custody_entry_count: int
    custody_errors: List[str]
    evidence_count: int
    evidence_verified_count: int
    evidence_failed_count: int
    evidence_details: List[EvidenceVerificationDetail]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": self.case_id,
            "overall_valid": self.overall_valid,
            "custody_valid": self.custody_valid,
            "custody_entry_count": self.custody_entry_count,
            "custody_errors": self.custody_errors,
            "evidence_count": self.evidence_count,
            "evidence_verified_count": self.evidence_verified_count,
            "evidence_failed_count": self.evidence_failed_count,
            "evidence_details": [d.to_dict() for d in self.evidence_details],
        }


class CaseManager:
    """Forensic case manager backed by SQLite and append-only custody log."""

    def __init__(self, base_cases_dir: Optional[Union[str, Path]] = None):
        if base_cases_dir is None:
            env_dir = os.environ.get("DVRX_CASES_DIR")
            self.base_dir = Path(env_dir) if env_dir else Path.cwd() / "cases"
        else:
            self.base_dir = Path(base_cases_dir)

    def get_case_dir(self, case_id: str) -> Path:
        """Sanitize case ID and return the case directory path."""
        clean_id = case_id.strip()
        if not clean_id or any(c in clean_id for c in r'<>:"/\|?*'):
            raise ValueError(f"Invalid case ID: '{case_id}' contains forbidden characters or is empty.")
        if ".." in clean_id:
            raise ValueError(f"Invalid case ID: traversal characters detected in '{case_id}'.")
        return self.base_dir / clean_id

    def _init_db(self, db_path: Path) -> sqlite3.Connection:
        """Initialize database tables with foreign keys enabled."""
        conn = sqlite3.connect(str(db_path))
        conn.execute("PRAGMA foreign_keys = ON;")
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    case_id TEXT PRIMARY KEY,
                    examiner TEXT NOT NULL,
                    created_utc TEXT NOT NULL,
                    created_raw TEXT NOT NULL,
                    tz_offset TEXT NOT NULL,
                    notes TEXT
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS evidence (
                    evidence_id TEXT PRIMARY KEY,
                    case_id TEXT NOT NULL REFERENCES cases(case_id),
                    source_path TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    md5 TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    acquired_utc TEXT NOT NULL,
                    acquired_raw TEXT NOT NULL,
                    tz_offset TEXT NOT NULL,
                    examiner TEXT NOT NULL,
                    notes TEXT
                );
                """
            )
        return conn

    def create_case(
        self,
        case_id: str,
        examiner: str,
        notes: str = "",
        timestamp: Optional[ForensicTimestamp] = None,
    ) -> CaseInfo:
        """Create a new forensic case, its SQLite database, and genesis custody entry."""
        case_dir = self.get_case_dir(case_id)
        if case_dir.exists():
            raise FileExistsError(f"Case directory already exists: {case_dir}")

        case_dir.mkdir(parents=True, exist_ok=True)
        db_path = case_dir / "case.db"
        custody_path = case_dir / "custody.jsonl"

        ts = timestamp if timestamp is not None else get_current_forensic_timestamp()

        # Initialize SQLite database
        conn = self._init_db(db_path)
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO cases (case_id, examiner, created_utc, created_raw, tz_offset, notes)
                    VALUES (?, ?, ?, ?, ?, ?);
                    """,
                    (case_id, examiner, ts.utc_iso, ts.raw_value, ts.tz_offset, notes),
                )
        finally:
            conn.close()

        # Initialize Custody Log and append genesis entry
        custody = CustodyLog(custody_path)
        custody.append(
            examiner=examiner,
            action="CASE_CREATED",
            file_hash=None,
            details={"case_id": case_id, "notes": notes},
            timestamp=ts,
        )

        return CaseInfo(
            case_id=case_id,
            examiner=examiner,
            created_utc=ts.utc_iso,
            created_raw=ts.raw_value,
            tz_offset=ts.tz_offset,
            case_dir=str(case_dir.resolve()),
            notes=notes,
        )

    def load_case(self, case_id: str) -> CaseInfo:
        """Load an existing case by ID."""
        case_dir = self.get_case_dir(case_id)
        db_path = case_dir / "case.db"
        if not db_path.exists():
            raise FileNotFoundError(f"Case database not found: {db_path}")

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.execute("SELECT * FROM cases WHERE case_id = ?;", (case_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Case ID '{case_id}' not found in database {db_path}")
            return CaseInfo(
                case_id=row["case_id"],
                examiner=row["examiner"],
                created_utc=row["created_utc"],
                created_raw=row["created_raw"],
                tz_offset=row["tz_offset"],
                case_dir=str(case_dir.resolve()),
                notes=row["notes"] or "",
            )
        finally:
            conn.close()

    def get_custody_log(self, case_id: str) -> CustodyLog:
        """Get the CustodyLog instance for a case."""
        case_dir = self.get_case_dir(case_id)
        custody_path = case_dir / "custody.jsonl"
        return CustodyLog(custody_path)

    def list_evidence(self, case_id: str) -> List[EvidenceRecord]:
        """List all evidence registered for a case."""
        case_dir = self.get_case_dir(case_id)
        db_path = case_dir / "case.db"
        if not db_path.exists():
            raise FileNotFoundError(f"Case database not found for case: {case_id}")

        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.execute("SELECT * FROM evidence WHERE case_id = ? ORDER BY acquired_utc ASC;", (case_id,))
            records = []
            for r in cur.fetchall():
                records.append(
                    EvidenceRecord(
                        evidence_id=r["evidence_id"],
                        case_id=r["case_id"],
                        source_path=r["source_path"],
                        file_size=r["file_size"],
                        md5=r["md5"],
                        sha256=r["sha256"],
                        acquired_utc=r["acquired_utc"],
                        acquired_raw=r["acquired_raw"],
                        tz_offset=r["tz_offset"],
                        examiner=r["examiner"],
                        notes=r["notes"] or "",
                    )
                )
            return records
        finally:
            conn.close()

    def acquire_evidence(
        self,
        case_id: str,
        source_path: Union[str, Path],
        examiner: Optional[str] = None,
        evidence_id: Optional[str] = None,
        notes: str = "",
        progress_callback: Optional[ProgressCallback] = None,
    ) -> EvidenceRecord:
        """Read source file read-only, compute streaming MD5+SHA256, register evidence, and log to custody."""
        case = self.load_case(case_id)
        active_examiner = examiner if examiner else case.examiner

        src = Path(source_path).resolve()
        if not src.exists():
            raise FileNotFoundError(f"Source evidence file does not exist: {src}")
        if src.is_dir():
            raise IsADirectoryError(f"Source evidence must be a file or image, not a directory: {src}")

        case_dir = self.get_case_dir(case_id)
        db_path = case_dir / "case.db"
        custody_path = case_dir / "custody.jsonl"

        # Determine evidence ID
        existing = self.list_evidence(case_id)
        ev_id = evidence_id if evidence_id else f"EVD-{len(existing) + 1:03d}"

        # Check for duplicate evidence ID
        if any(e.evidence_id == ev_id for e in existing):
            raise ValueError(f"Evidence ID '{ev_id}' already registered in case '{case_id}'.")

        # Streaming hash in single read-only pass
        hash_result: HashResult = hash_file(src, progress_callback=progress_callback)

        ts = get_current_forensic_timestamp()

        # Save to SQLite database
        conn = sqlite3.connect(str(db_path))
        try:
            with conn:
                conn.execute(
                    """
                    INSERT INTO evidence (
                        evidence_id, case_id, source_path, file_size, md5, sha256,
                        acquired_utc, acquired_raw, tz_offset, examiner, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        ev_id,
                        case_id,
                        str(src),
                        hash_result.file_size,
                        hash_result.md5,
                        hash_result.sha256,
                        ts.utc_iso,
                        ts.raw_value,
                        ts.tz_offset,
                        active_examiner,
                        notes,
                    ),
                )
        finally:
            conn.close()

        # Append to hash-chained custody log
        custody = CustodyLog(custody_path)
        custody.append(
            examiner=active_examiner,
            action="EVIDENCE_ACQUIRED",
            file_hash={"md5": hash_result.md5, "sha256": hash_result.sha256},
            details={
                "evidence_id": ev_id,
                "source_path": str(src),
                "file_size": hash_result.file_size,
                "elapsed_seconds": round(hash_result.elapsed_seconds, 4),
            },
            timestamp=ts,
        )

        return EvidenceRecord(
            evidence_id=ev_id,
            case_id=case_id,
            source_path=str(src),
            file_size=hash_result.file_size,
            md5=hash_result.md5,
            sha256=hash_result.sha256,
            acquired_utc=ts.utc_iso,
            acquired_raw=ts.raw_value,
            tz_offset=ts.tz_offset,
            examiner=active_examiner,
            notes=notes,
        )

    def verify_case(
        self,
        case_id: str,
        examiner: Optional[str] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> VerificationReport:
        """Verify chain-of-custody log integrity and re-hash registered evidence files."""
        case = self.load_case(case_id)
        active_examiner = examiner if examiner else case.examiner

        custody = self.get_custody_log(case_id)
        custody_res = custody.verify()

        evidence_list = self.list_evidence(case_id)
        evidence_details: List[EvidenceVerificationDetail] = []
        verified_count = 0
        failed_count = 0

        for ev in evidence_list:
            ev_path = Path(ev.source_path)
            if not ev_path.exists():
                failed_count += 1
                evidence_details.append(
                    EvidenceVerificationDetail(
                        evidence_id=ev.evidence_id,
                        source_path=ev.source_path,
                        is_valid=False,
                        status="MISSING_FILE",
                        recorded_md5=ev.md5,
                        computed_md5=None,
                        recorded_sha256=ev.sha256,
                        computed_sha256=None,
                    )
                )
                continue

            try:
                # Re-compute hashes in streaming read-only mode
                h = hash_file(ev_path, progress_callback=progress_callback)
                md5_match = h.md5 == ev.md5
                sha256_match = h.sha256 == ev.sha256
                is_match = md5_match and sha256_match

                if is_match:
                    verified_count += 1
                    status = "VERIFIED_MATCH"
                else:
                    failed_count += 1
                    status = "HASH_MISMATCH"

                evidence_details.append(
                    EvidenceVerificationDetail(
                        evidence_id=ev.evidence_id,
                        source_path=ev.source_path,
                        is_valid=is_match,
                        status=status,
                        recorded_md5=ev.md5,
                        computed_md5=h.md5,
                        recorded_sha256=ev.sha256,
                        computed_sha256=h.sha256,
                    )
                )
            except Exception as exc:
                failed_count += 1
                evidence_details.append(
                    EvidenceVerificationDetail(
                        evidence_id=ev.evidence_id,
                        source_path=ev.source_path,
                        is_valid=False,
                        status=f"READ_ERROR: {exc}",
                        recorded_md5=ev.md5,
                        computed_md5=None,
                        recorded_sha256=ev.sha256,
                        computed_sha256=None,
                    )
                )

        overall_valid = custody_res.is_valid and (failed_count == 0)

        # Append verification action to custody log
        ts = get_current_forensic_timestamp()
        custody.append(
            examiner=active_examiner,
            action="CASE_VERIFIED",
            file_hash=None,
            details={
                "overall_valid": overall_valid,
                "custody_valid": custody_res.is_valid,
                "custody_entry_count": custody_res.entry_count,
                "evidence_count": len(evidence_list),
                "verified_count": verified_count,
                "failed_count": failed_count,
            },
            timestamp=ts,
        )

        return VerificationReport(
            case_id=case_id,
            overall_valid=overall_valid,
            custody_valid=custody_res.is_valid,
            custody_entry_count=custody_res.entry_count,
            custody_errors=custody_res.errors,
            evidence_count=len(evidence_list),
            evidence_verified_count=verified_count,
            evidence_failed_count=failed_count,
            evidence_details=evidence_details,
        )
