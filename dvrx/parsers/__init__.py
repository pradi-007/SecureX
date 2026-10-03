"""DVRX Vendor Parsers package.

Multi-Vendor DVR/NVR architecture supporting 8 OEM families + Generic Frame Carver:
- Hikvision OEM / HIK format
- Dahua Technology (DHFS 4.0 / DHAV)
- CP Plus (Orange & Indigo series)
- Honeywell Enterprise NVR
- Uniview (UNV) UBV container
- TP-Link (VIGI) series
- Godrej Security Systems (SeeThru)
- Matrix (SATATYA enterprise series)
- Generic Frame Carver Fallback
"""

from dvrx.parsers.base import BaseParser, RecordingMetadata
from dvrx.parsers.cpplus import CPPlusParser
from dvrx.parsers.dahua import DahuaParser
from dvrx.parsers.detector import (
    detect_and_parse_evidence,
    detect_vendor_from_stream,
    get_all_supported_vendors,
)
from dvrx.parsers.generic_carver import GenericFrameCarver
from dvrx.parsers.godrej import GodrejParser
from dvrx.parsers.hikvision import HikvisionParser
from dvrx.parsers.honeywell import HoneywellParser
from dvrx.parsers.matrix import MatrixParser
from dvrx.parsers.tplink import TPLinkVigiParser
from dvrx.parsers.uniview import UniviewParser

__all__ = [
    "BaseParser",
    "RecordingMetadata",
    "HikvisionParser",
    "DahuaParser",
    "CPPlusParser",
    "HoneywellParser",
    "UniviewParser",
    "TPLinkVigiParser",
    "GodrejParser",
    "MatrixParser",
    "GenericFrameCarver",
    "detect_and_parse_evidence",
    "detect_vendor_from_stream",
    "get_all_supported_vendors",
]
