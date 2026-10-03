"""Shared test fixtures for DVRX tests."""

from pathlib import Path
import pytest


@pytest.fixture
def make_synthetic_file(tmp_path: Path):
    """Factory fixture to create synthetic binary or text evidence files."""

    def _create(name: str, content: bytes) -> Path:
        file_path = tmp_path / name
        file_path.write_bytes(content)
        return file_path

    return _create


@pytest.fixture
def synthetic_dvr_image(tmp_path: Path) -> Path:
    """Creates a synthetic 2MB binary image file simulating DVR disk raw capture."""
    image_path = tmp_path / "synthetic_dvr.dd"
    # Create deterministic synthetic pattern: 2MB of alternating blocks
    pattern = b"DVRX_FORENSIC_RAW_BLOCK_PATTERN_0123456789\x00\xff\x55\xaa" * 1024
    with open(image_path, "wb") as f:
        for _ in range(40):  # ~2MB
            f.write(pattern)
    return image_path
