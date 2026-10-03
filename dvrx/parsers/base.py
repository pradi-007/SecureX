"""Base parser interface for DVR/NVR proprietary file systems.

Forensic Rule: Every vendor parser implements a BaseParser interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Dict, Generator, List, Optional, Union


@dataclass(frozen=True)
class RecordingMetadata:
    """Standardized metadata for an extracted DVR/NVR video recording."""

    recording_id: str
    channel_id: int
    start_time_utc: str
    end_time_utc: str
    start_time_raw: str
    end_time_raw: str
    tz_offset: str
    file_offset: int
    byte_length: int
    codec: str  # e.g. "h264", "h265"
    resolution: Optional[str] = None
    extra_metadata: Optional[Dict[str, str]] = None


class BaseParser(ABC):
    """Abstract Base Class that every vendor-specific parser must implement."""

    @property
    @abstractmethod
    def vendor_name(self) -> str:
        """Name of the DVR/NVR vendor (e.g. 'Hikvision', 'Dahua')."""
        pass

    @abstractmethod
    def identify(self, stream: BinaryIO) -> bool:
        """Inspect disk signatures or partition layout to determine if this parser applies."""
        pass

    @abstractmethod
    def parse_file_system(self, stream: BinaryIO) -> Dict[str, object]:
        """Parse disk structures, volume headers, index blocks, and allocation tables."""
        pass

    @abstractmethod
    def list_recordings(self, stream: BinaryIO) -> List[RecordingMetadata]:
        """Index and list all active/allocated recordings from the file system."""
        pass

    @abstractmethod
    def extract_recording(
        self,
        stream: BinaryIO,
        recording: RecordingMetadata,
        output_path: Union[str, Path],
    ) -> int:
        """Extract a single recording to a local file. Returns total bytes written."""
        pass
