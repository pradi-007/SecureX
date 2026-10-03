"""Streaming cryptographic hashing for DVRX forensic evidence.

Forensic Rules:
- Evidence is READ-ONLY. Never write to a source image or device.
- Compute MD5 and SHA-256 in a single streaming pass (never load images into RAM).
- Includes progress callback support.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import time
from typing import Callable, Optional, Union

# Default streaming buffer chunk size: 1 MB
DEFAULT_CHUNK_SIZE = 1024 * 1024

ProgressCallback = Callable[[int, int], None]


@dataclass(frozen=True)
class HashResult:
    """Forensic hash result containing both MD5 and SHA-256 digests."""

    md5: str
    sha256: str
    file_size: int
    elapsed_seconds: float
    chunk_count: int

    def to_dict(self) -> dict:
        return {
            "md5": self.md5,
            "sha256": self.sha256,
            "file_size": self.file_size,
            "elapsed_seconds": self.elapsed_seconds,
            "chunk_count": self.chunk_count,
        }


def hash_file(
    filepath: Union[str, Path],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    progress_callback: Optional[ProgressCallback] = None,
) -> HashResult:
    """Stream an evidence file in a single read-only pass and compute MD5 and SHA-256.

    Args:
        filepath: Path to the evidence file or disk image.
        chunk_size: Number of bytes to read per iteration (default 1 MB).
        progress_callback: Optional callable(bytes_processed, total_bytes).

    Returns:
        HashResult dataclass with lowercase hex digests and metadata.

    Raises:
        FileNotFoundError: If filepath does not exist.
        IsADirectoryError: If filepath is a directory.
        PermissionError: If file cannot be read.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Evidence file not found: {path}")
    if path.is_dir():
        raise IsADirectoryError(f"Evidence path is a directory, not a file: {path}")

    total_bytes = os.path.getsize(path)
    md5_hasher = hashlib.md5()
    sha256_hasher = hashlib.sha256()

    bytes_read = 0
    chunk_count = 0
    start_time = time.perf_counter()

    # Read-only binary mode ('rb') ensures no modification to source evidence
    with open(path, "rb") as f:
        # Initial callback notification
        if progress_callback is not None:
            progress_callback(0, total_bytes)

        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break

            md5_hasher.update(chunk)
            sha256_hasher.update(chunk)
            bytes_read += len(chunk)
            chunk_count += 1

            if progress_callback is not None:
                progress_callback(bytes_read, total_bytes)

    elapsed = time.perf_counter() - start_time

    return HashResult(
        md5=md5_hasher.hexdigest().lower(),
        sha256=sha256_hasher.hexdigest().lower(),
        file_size=bytes_read,
        elapsed_seconds=elapsed,
        chunk_count=chunk_count,
    )
