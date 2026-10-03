"""Tests for Multi-Vendor DVR/NVR Parsers and Auto-Detection Engine.

Validates all 8 OEM vendor families + Generic Frame Carver fallback:
1. Hikvision (HIKFS / HIK format)
2. Dahua Technology (DHFS 4.0 / DHAV)
3. CP Plus (Orange & Indigo series)
4. Honeywell (Enterprise NVR line)
5. Uniview (UNV) (UBV container)
6. TP-Link (VIGI surveillance series)
7. Godrej (Security Systems SeeThru)
8. Matrix (SATATYA enterprise series)
9. Generic Frame Carver Fallback
"""

import io
from pathlib import Path
import pytest

from dvrx.parsers.base import RecordingMetadata
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


def test_supported_vendors_catalog():
    vendors = get_all_supported_vendors()
    assert len(vendors) == 9  # 8 OEM families + 1 Generic Carver
    names = [v["vendor"] for v in vendors]
    assert "Hikvision" in names
    assert "Dahua Technology" in names
    assert "CP Plus" in names
    assert "Honeywell" in names
    assert "Uniview (UNV)" in names
    assert "TP-Link (VIGI)" in names
    assert "Godrej" in names
    assert "Matrix" in names
    assert "Generic Frame Carver" in names


def test_hikvision_parser(tmp_path: Path):
    parser = HikvisionParser()
    data = b"HIKVISION_NVR_HEADER_CHANNEL_01_STREAM_BLOCK_00\x00\x00\x00\x01\x67\x42\x00\x1e"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "Hikvision"
    assert fs["primary_channel"] == 1

    recordings = parser.list_recordings(stream)
    assert len(recordings) == 1
    assert recordings[0].recording_id == "HIK-CH1-STREAM-001"

    out_file = tmp_path / "hik_out.raw"
    written = parser.extract_recording(stream, recordings[0], out_file)
    assert written == len(data)
    assert out_file.read_bytes() == data


def test_dahua_parser(tmp_path: Path):
    parser = DahuaParser()
    data = b"DHFS_SUPERBLOCK_V4_MAGIC_DHAV_FRAME_BLOCK_CHANNEL_02\x00\x00\x00\x01\x65\x88"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "Dahua Technology"
    assert fs["primary_channel"] == 2
    assert fs["dhav_markers_found"] >= 1

    recs = parser.list_recordings(stream)
    assert len(recs) == 1
    assert recs[0].recording_id == "DAHUA-DHFS-CH1-001"


def test_cpplus_parser():
    parser = CPPlusParser()
    data = b"CPPLUS_INDIGO_SERIES_NVR_RECORDING_CHANNEL_01\x00\x00\x00\x01\x67"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "CP Plus"
    assert "Indigo" in fs["series"]


def test_honeywell_parser():
    parser = HoneywellParser()
    data = b"HONEYWELL_ENTERPRISE_NVR_PARTITION_CH_04\x00\x00\x00\x01\x67"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "Honeywell"
    assert fs["primary_channel"] == 4


def test_uniview_parser():
    parser = UniviewParser()
    data = b"UBV0_UNIVIEW_PACKET_HEADER_CH_01\x00\x00\x00\x01\x67"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "Uniview (UNV)"


def test_tplink_vigi_parser():
    parser = TPLinkVigiParser()
    data = b"VIGI_NVR_STREAM_CONTAINER_CH_01\x00\x00\x00\x01\x67"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "TP-Link (VIGI)"


def test_godrej_parser():
    parser = GodrejParser()
    data = b"GODREJ_SEETHRU_SURVEILLANCE_CHANNEL_01\x00\x00\x00\x01\x67"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "Godrej"


def test_matrix_parser():
    parser = MatrixParser()
    data = b"MATRIX_SATATYA_NVR_STREAM_CH_01\x00\x00\x00\x01\x67"
    stream = io.BytesIO(data)

    assert parser.identify(stream) is True
    fs = parser.parse_file_system(stream)
    assert fs["vendor"] == "Matrix"


def test_generic_frame_carver_fallback():
    carver = GenericFrameCarver()
    # Stream with no vendor markers, only raw H.264 NAL units
    data = (
        b"\x00\x00\x00\x01\x67\x42\x00\x1e"  # SPS
        b"\x00\x00\x00\x01\x68\xce\x3c\x80"  # PPS
        b"\x00\x00\x00\x01\x65\x88\x84\x00"  # IDR Keyframe
        b"\x00\x00\x01\x61\x9a\x01\x02"      # 3-byte slice
    )
    stream = io.BytesIO(data)

    assert carver.identify(stream) is True
    fs = carver.parse_file_system(stream)
    assert fs["vendor"] == "Generic Frame Carver"
    assert fs["nal_units_detected"] >= 3
    assert fs["keyframes_identified"] >= 1
    assert fs["sps_headers"] >= 1


def test_auto_detector_routing(tmp_path: Path):
    # 1. Dahua file
    dahua_file = tmp_path / "dahua.dd"
    dahua_file.write_bytes(b"DHFS_CONTAINER_STREAM_DHAV_DATA_CH1")
    res_dahua = detect_and_parse_evidence(dahua_file)
    assert res_dahua["status"] == "ok"
    assert res_dahua["vendor"] == "Dahua Technology"
    assert res_dahua["is_carver_fallback"] is False

    # 2. Generic carver fallback file
    generic_file = tmp_path / "generic.raw"
    generic_file.write_bytes(b"\x00\x00\x00\x01\x67\x42\x00\x1e\x00\x00\x00\x01\x65\x88\x84")
    res_generic = detect_and_parse_evidence(generic_file)
    assert res_generic["status"] == "ok"
    assert res_generic["vendor"] == "Generic Frame Carver"
    assert res_generic["is_carver_fallback"] is True

    # 3. Manual override
    res_override = detect_and_parse_evidence(generic_file, selected_vendor="Hikvision")
    assert res_override["vendor"] == "Hikvision"
