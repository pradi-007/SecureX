"""Hash-chained, append-only chain-of-custody log for forensic accountability.

Forensic Rules:
- Every action is appended to a hash-chained, append-only log.
- Each entry stores previous entry's hash, examiner, UTC timestamp, action, and file hash.
- Timestamps store UTC, raw local string, and timezone offset.
- Verify function detects any tampering, alteration, omission, or insertion.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from dvrx.core.time_utils import ForensicTimestamp, get_current_forensic_timestamp

GENESIS_PREV_HASH = "0" * 64


@dataclass(frozen=True)
class CustodyEntry:
    """A single immutable entry in the forensic chain of custody."""

    entry_id: int
    prev_hash: str
    timestamp_utc: str
    timestamp_raw: str
    tz_offset: str
    examiner: str
    action: str
    file_hash: Optional[Dict[str, str]]
    details: Dict[str, Any]
    entry_hash: str

    def payload_dict(self) -> Dict[str, Any]:
        """Dictionary of fields covered by the cryptographic entry_hash."""
        return {
            "entry_id": self.entry_id,
            "prev_hash": self.prev_hash,
            "timestamp_utc": self.timestamp_utc,
            "timestamp_raw": self.timestamp_raw,
            "tz_offset": self.tz_offset,
            "examiner": self.examiner,
            "action": self.action,
            "file_hash": self.file_hash,
            "details": self.details,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Full dictionary representation including entry_hash."""
        d = self.payload_dict()
        d["entry_hash"] = self.entry_hash
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CustodyEntry:
        return cls(
            entry_id=int(data["entry_id"]),
            prev_hash=str(data["prev_hash"]),
            timestamp_utc=str(data["timestamp_utc"]),
            timestamp_raw=str(data["timestamp_raw"]),
            tz_offset=str(data["tz_offset"]),
            examiner=str(data["examiner"]),
            action=str(data["action"]),
            file_hash=data.get("file_hash"),
            details=data.get("details", {}),
            entry_hash=str(data["entry_hash"]),
        )


def compute_canonical_hash(payload: Dict[str, Any]) -> str:
    """Compute SHA-256 hash over canonical JSON representation."""
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest().lower()


@dataclass(frozen=True)
class CustodyVerificationResult:
    """Result of a custody chain cryptographic verification."""

    is_valid: bool
    entry_count: int
    errors: List[str]
    entries: List[CustodyEntry]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "entry_count": self.entry_count,
            "errors": self.errors,
            "entries": [e.to_dict() for e in self.entries],
        }


class CustodyLog:
    """Manages an append-only, hash-chained custody log on disk."""

    def __init__(self, log_path: Union[str, Path]):
        self.log_path = Path(log_path)
        self._entries: List[CustodyEntry] = []
        self._load()

    @property
    def entries(self) -> List[CustodyEntry]:
        return list(self._entries)

    @property
    def latest_entry(self) -> Optional[CustodyEntry]:
        return self._entries[-1] if self._entries else None

    def _load(self) -> None:
        """Load and parse existing entries if the log file exists."""
        self._entries = []
        if not self.log_path.exists():
            return

        with open(self.log_path, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                clean_line = line.strip()
                if not clean_line:
                    continue
                try:
                    data = json.loads(clean_line)
                    entry = CustodyEntry.from_dict(data)
                    self._entries.append(entry)
                except Exception as exc:
                    raise ValueError(
                        f"Corrupted or invalid JSON on line {line_no} of custody log {self.log_path}: {exc}"
                    ) from exc

    def append(
        self,
        examiner: str,
        action: str,
        file_hash: Optional[Dict[str, str]] = None,
        details: Optional[Dict[str, Any]] = None,
        timestamp: Optional[ForensicTimestamp] = None,
    ) -> CustodyEntry:
        """Append an action to the hash chain and write it immediately to disk."""
        if timestamp is None:
            ts = get_current_forensic_timestamp()
        else:
            ts = timestamp

        entry_id = len(self._entries) + 1
        prev_hash = self.latest_entry.entry_hash if self.latest_entry else GENESIS_PREV_HASH
        clean_details = details if details is not None else {}

        payload: Dict[str, Any] = {
            "entry_id": entry_id,
            "prev_hash": prev_hash,
            "timestamp_utc": ts.utc_iso,
            "timestamp_raw": ts.raw_value,
            "tz_offset": ts.tz_offset,
            "examiner": examiner,
            "action": action,
            "file_hash": file_hash,
            "details": clean_details,
        }

        entry_hash = compute_canonical_hash(payload)

        entry = CustodyEntry(
            entry_id=entry_id,
            prev_hash=prev_hash,
            timestamp_utc=ts.utc_iso,
            timestamp_raw=ts.raw_value,
            tz_offset=ts.tz_offset,
            examiner=examiner,
            action=action,
            file_hash=file_hash,
            details=clean_details,
            entry_hash=entry_hash,
        )

        # Append-only write to disk with parent directory creation
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.log_path, "a", encoding="utf-8") as f:
            line = json.dumps(entry.to_dict(), sort_keys=True, separators=(",", ":"), ensure_ascii=True)
            f.write(line + "\n")
            f.flush()
            try:
                os.fsync(f.fileno())
            except OSError:
                pass

        self._entries.append(entry)
        return entry

    def verify(self) -> CustodyVerificationResult:
        """Verify the integrity of this custody log."""
        return verify_custody_log(self._entries)


def verify_custody_log(
    target: Union[str, Path, List[CustodyEntry]]
) -> CustodyVerificationResult:
    """Verify cryptographic integrity of custody entries or custody log file.

    Checks:
    1. Genesis entry prev_hash equals GENESIS_PREV_HASH (64 zeros).
    2. Sequential entry IDs (1, 2, 3...).
    3. Each entry's entry_hash matches the canonical SHA-256 computation over its payload.
    4. Each entry's prev_hash strictly matches the previous entry's entry_hash.
    """
    entries: List[CustodyEntry] = []
    if isinstance(target, (str, Path)):
        path = Path(target)
        if not path.exists():
            return CustodyVerificationResult(
                is_valid=False,
                entry_count=0,
                errors=[f"Custody log file does not exist: {path}"],
                entries=[],
            )
        with open(path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f, start=1):
                clean_line = line.strip()
                if not clean_line:
                    continue
                try:
                    data = json.loads(clean_line)
                    entries.append(CustodyEntry.from_dict(data))
                except Exception as exc:
                    return CustodyVerificationResult(
                        is_valid=False,
                        entry_count=len(entries),
                        errors=[f"Line {idx} cannot be parsed as a valid custody record: {exc}"],
                        entries=entries,
                    )
    else:
        entries = list(target)

    if not entries:
        return CustodyVerificationResult(
            is_valid=True,
            entry_count=0,
            errors=[],
            entries=[],
        )

    errors: List[str] = []
    expected_prev = GENESIS_PREV_HASH

    for idx, entry in enumerate(entries, start=1):
        # 1. Verify sequential entry_id
        if entry.entry_id != idx:
            errors.append(
                f"Entry at index {idx} has invalid entry_id {entry.entry_id} (expected {idx})"
            )

        # 2. Verify prev_hash link
        if entry.prev_hash != expected_prev:
            errors.append(
                f"Entry #{entry.entry_id} prev_hash mismatch: expected '{expected_prev}', found '{entry.prev_hash}'"
            )

        # 3. Verify entry payload integrity
        recomputed_hash = compute_canonical_hash(entry.payload_dict())
        if recomputed_hash != entry.entry_hash:
            errors.append(
                f"Entry #{entry.entry_id} content tampered: recomputed hash '{recomputed_hash}' does not match recorded hash '{entry.entry_hash}'"
            )

        expected_prev = entry.entry_hash

    is_valid = len(errors) == 0
    return CustodyVerificationResult(
        is_valid=is_valid,
        entry_count=len(entries),
        errors=errors,
        entries=entries,
    )
