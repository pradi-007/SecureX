"""Multi-Vendor DVR/NVR Automated Detection Engine.

Automatically inspects disk images or video bitstreams, identifies OEM hardware signatures,
and routes to the appropriate vendor parser (Hikvision, Dahua, CP Plus, Honeywell,
Uniview, TP-Link, Godrej, Matrix, or Generic Carver fallback).
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO, Dict, List, Optional, Tuple, Type, Union

from dvrx.parsers.base import BaseParser, RecordingMetadata
from dvrx.parsers.cpplus import CPPlusParser
from dvrx.parsers.dahua import DahuaParser
from dvrx.parsers.generic_carver import GenericFrameCarver
from dvrx.parsers.godrej import GodrejParser
from dvrx.parsers.hikvision import HikvisionParser
from dvrx.parsers.honeywell import HoneywellParser
from dvrx.parsers.matrix import MatrixParser
from dvrx.parsers.tplink import TPLinkVigiParser
from dvrx.parsers.uniview import UniviewParser

# Priority list of proprietary vendor parsers
VENDOR_PARSER_CLASSES: List[Type[BaseParser]] = [
    HikvisionParser,
    DahuaParser,
    CPPlusParser,
    HoneywellParser,
    UniviewParser,
    TPLinkVigiParser,
    GodrejParser,
    MatrixParser,
]


def get_all_supported_vendors() -> List[Dict[str, str]]:
    """Return descriptive catalog of all operational vendor parsers in the engine."""
    catalog = []
    for cls in VENDOR_PARSER_CLASSES:
        p = cls()
        catalog.append({
            "vendor": p.vendor_name,
            "family": p.family_name,
            "filesystem": p.filesystem_type,
            "status": "In Core Architecture (Operational)",
            "parser_module": f"dvrx.parsers.{cls.__module__.split('.')[-1]}",
        })
    # Add carver fallback
    carver = GenericFrameCarver()
    catalog.append({
        "vendor": carver.vendor_name,
        "family": carver.family_name,
        "filesystem": carver.filesystem_type,
        "status": "Universal Carver Fallback (Operational)",
        "parser_module": "dvrx.parsers.generic_carver",
    })
    return catalog


def detect_vendor_from_stream(stream: BinaryIO) -> Tuple[BaseParser, float, bool]:
    """Test all vendor parsers against a read-only stream.
    
    Returns:
        (matched_parser_instance, confidence_score, is_carver_fallback)
    """
    pos = stream.tell()

    # 1. Test proprietary vendor signatures
    for cls in VENDOR_PARSER_CLASSES:
        parser = cls()
        stream.seek(pos)
        if parser.identify(stream):
            stream.seek(pos)
            return parser, 0.96, False

    # 2. Fall back to Generic Frame Carver
    stream.seek(pos)
    carver = GenericFrameCarver()
    return carver, 0.85, True


def detect_and_parse_evidence(
    source: Union[str, Path, BinaryIO],
    selected_vendor: Optional[str] = None,
) -> Dict[str, object]:
    """Perform end-to-end multi-vendor detection and parsing on an evidence stream or file.

    If selected_vendor is specified, manually enforces that parser instead of auto-detecting.
    """
    should_close = False
    if isinstance(source, (str, Path)):
        src_path = Path(source)
        if not src_path.exists():
            raise FileNotFoundError(f"Evidence file not found: {src_path}")
        stream = open(src_path, "rb")
        should_close = True
    else:
        stream = source

    try:
        parser: BaseParser
        confidence: float
        is_fallback: bool

        if selected_vendor:
            # Manual vendor selection override
            matched_cls = next(
                (c for c in VENDOR_PARSER_CLASSES if c().vendor_name.lower() == selected_vendor.lower()),
                None,
            )
            if matched_cls:
                parser = matched_cls()
                confidence = 1.0
                is_fallback = False
            else:
                parser = GenericFrameCarver()
                confidence = 0.90
                is_fallback = True
        else:
            parser, confidence, is_fallback = detect_vendor_from_stream(stream)

        # Parse file system & index recordings
        stream.seek(0)
        fs_info = parser.parse_file_system(stream)

        stream.seek(0)
        recordings = parser.list_recordings(stream)

        return {
            "status": "ok",
            "vendor": parser.vendor_name,
            "family": parser.family_name,
            "filesystem": parser.filesystem_type,
            "confidence": confidence,
            "confidence_percent": int(confidence * 100),
            "parser_class": parser.__class__.__name__,
            "is_carver_fallback": is_fallback,
            "file_system_info": fs_info,
            "recordings": [
                {
                    "recording_id": r.recording_id,
                    "channel_id": r.channel_id,
                    "start_time_utc": r.start_time_utc,
                    "end_time_utc": r.end_time_utc,
                    "start_time_raw": r.start_time_raw,
                    "end_time_raw": r.end_time_raw,
                    "tz_offset": r.tz_offset,
                    "file_offset": r.file_offset,
                    "byte_length": r.byte_length,
                    "codec": r.codec,
                    "resolution": r.resolution,
                    "extra_metadata": r.extra_metadata,
                }
                for r in recordings
            ],
            "recording_count": len(recordings),
        }
    finally:
        if should_close:
            stream.close()
