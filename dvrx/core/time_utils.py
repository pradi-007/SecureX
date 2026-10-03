"""Forensic timestamp handling for DVRX.

Strict requirement: All timestamps are stored as UTC plus the original raw value
and timezone offset.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class ForensicTimestamp:
    """Forensically sound timestamp capturing UTC, raw local string, and timezone offset."""

    utc_iso: str
    raw_value: str
    tz_offset: str

    def to_dict(self) -> Dict[str, str]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ForensicTimestamp:
        return cls(
            utc_iso=data["utc_iso"],
            raw_value=data["raw_value"],
            tz_offset=data["tz_offset"],
        )


def format_tz_offset(dt: datetime) -> str:
    """Format the timezone offset of a datetime as +HH:MM or -HH:MM or Z."""
    offset = dt.utcoffset()
    if offset is None:
        return "+00:00"
    total_seconds = int(offset.total_seconds())
    if total_seconds == 0:
        return "+00:00"
    sign = "+" if total_seconds >= 0 else "-"
    total_seconds = abs(total_seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    return f"{sign}{hours:02d}:{minutes:02d}"


def get_current_forensic_timestamp(dt: Optional[datetime] = None) -> ForensicTimestamp:
    """Generate a ForensicTimestamp for the given datetime or current local time."""
    if dt is None:
        local_dt = datetime.now().astimezone()
    else:
        if dt.tzinfo is None:
            # Assume local timezone if naive
            local_dt = dt.astimezone()
        else:
            local_dt = dt

    utc_dt = local_dt.astimezone(timezone.utc)
    utc_iso = utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    raw_value = local_dt.strftime("%Y-%m-%dT%H:%M:%S")
    tz_offset = format_tz_offset(local_dt)

    return ForensicTimestamp(
        utc_iso=utc_iso,
        raw_value=raw_value,
        tz_offset=tz_offset,
    )
