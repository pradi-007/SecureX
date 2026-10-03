"""Tests for dvrx.core.hasher module."""

import hashlib
import os
from pathlib import Path
import pytest

from dvrx.core.hasher import HashResult, hash_file


def test_hash_empty_file(tmp_path: Path):
    """Empty files must produce standard MD5 and SHA-256 digests."""
    empty_file = tmp_path / "empty.bin"
    empty_file.write_bytes(b"")

    result = hash_file(empty_file)

    assert isinstance(result, HashResult)
    assert result.file_size == 0
    assert result.md5 == "d41d8cd98f00b204e9800998ecf8427e"
    assert result.sha256 == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_hash_synthetic_binary_data(tmp_path: Path):
    """Hashing arbitrary synthetic data produces exact match with hashlib."""
    test_file = tmp_path / "sample.dd"
    data = b"FORENSIC_EVIDENCE_PAYLOAD_CHUNK_" * 5000  # ~160 KB
    test_file.write_bytes(data)

    expected_md5 = hashlib.md5(data).hexdigest().lower()
    expected_sha256 = hashlib.sha256(data).hexdigest().lower()

    result = hash_file(test_file)

    assert result.file_size == len(data)
    assert result.md5 == expected_md5
    assert result.sha256 == expected_sha256
    assert result.chunk_count >= 1


def test_streaming_hasher_with_progress_callback(tmp_path: Path):
    """Tests chunked streaming computation and progress callback tracking."""
    test_file = tmp_path / "large_synthetic.raw"
    chunk_unit = b"STREAMING_TEST_BLOCK" * 1024  # 20 KB
    total_chunks = 50  # 1 MB total
    data = chunk_unit * total_chunks
    test_file.write_bytes(data)

    progress_events = []

    def on_progress(bytes_read: int, total_bytes: int):
        progress_events.append((bytes_read, total_bytes))

    # Use a small chunk size of 64KB to guarantee multiple read passes
    result = hash_file(test_file, chunk_size=65536, progress_callback=on_progress)

    expected_md5 = hashlib.md5(data).hexdigest().lower()
    expected_sha256 = hashlib.sha256(data).hexdigest().lower()

    assert result.md5 == expected_md5
    assert result.sha256 == expected_sha256
    assert result.file_size == len(data)
    assert result.chunk_count > 1

    # Check progress callback was triggered
    assert len(progress_events) > 1
    # First call is 0 bytes
    assert progress_events[0] == (0, len(data))
    # Last call should equal total bytes
    assert progress_events[-1] == (len(data), len(data))
    # Bytes read must monotonically increase
    bytes_read_sequence = [event[0] for event in progress_events]
    assert bytes_read_sequence == sorted(bytes_read_sequence)


def test_hasher_preserves_evidence_read_only(tmp_path: Path):
    """Forensic rule: source evidence is never modified."""
    evidence_file = tmp_path / "immutable_evidence.bin"
    initial_content = b"\x00\x01\x02\x03\x04\x05\xaa\xbb\xcc\xdd" * 100
    evidence_file.write_bytes(initial_content)

    mtime_before = evidence_file.stat().st_mtime_ns

    result = hash_file(evidence_file)

    mtime_after = evidence_file.stat().st_mtime_ns
    content_after = evidence_file.read_bytes()

    assert result.file_size == len(initial_content)
    assert content_after == initial_content
    assert mtime_before == mtime_after


def test_hasher_file_not_found():
    """Hasher raises FileNotFoundError for non-existent evidence."""
    with pytest.raises(FileNotFoundError):
        hash_file("non_existent_image_12345.dd")


def test_hasher_is_directory_error(tmp_path: Path):
    """Hasher raises IsADirectoryError when passed a folder."""
    with pytest.raises(IsADirectoryError):
        hash_file(tmp_path)
