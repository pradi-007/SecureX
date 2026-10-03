# DVR/NVR Forensic Analysis Tool

**Development of a Multi-Vendor DVR/NVR Forensic Analysis Tool for Standardized Acquisition, Recovery, and Analysis of Surveillance Evidence**

> Status: 🚧 In development (prototype phase)

---

## 1. Overview

Digital and Network Video Recorders (DVR/NVRs) are used everywhere from homes to critical infrastructure, and their footage is often the key evidence in an investigation. Each manufacturer, however, uses its own proprietary file system, metadata layout, and video container. Investigators end up juggling many vendor-specific tools, which leads to:

- Longer investigation times and inconsistent results
- Timestamp and time-zone mismatches between devices
- Difficulty recovering deleted or damaged recordings
- Weak chain-of-custody and evidence-integrity records
- No standard report format

This project provides a **single, vendor-agnostic forensic platform** with one standardized workflow for **acquisition, recovery, analysis, validation, and reporting** of surveillance evidence.

---

## 2. Objectives

- Automatically identify the DVR/NVR vendor and model
- Create forensically sound images (read-only, hashed)
- Parse proprietary file systems and extract video and metadata
- Decode vendor formats into standard, playable video (MP4)
- Recover deleted or damaged footage (file-system based and carving)
- Normalize timestamps and correlate events across cameras
- Maintain a tamper-evident chain of custody
- Run AI analytics (motion, object, and face detection)
- Generate standardized, court-ready reports

---

## 3. Supported Vendors

| Vendor | Identification | Parsing | Recovery | Status |
|---|---|---|---|---|
| Hikvision | ⬜ | ⬜ | ⬜ | Planned |
| Dahua Technology | ⬜ | ⬜ | ⬜ | Planned |
| CP Plus | ⬜ | ⬜ | ⬜ | Planned |
| Honeywell Security | ⬜ | ⬜ | ⬜ | Planned |
| Uniview | ⬜ | ⬜ | ⬜ | Planned |
| TP-Link (VIGI) | ⬜ | ⬜ | ⬜ | Planned |
| Godrej | ⬜ | ⬜ | ⬜ | Planned |
| Matrix | ⬜ | ⬜ | ⬜ | Planned |
| Generic (any vendor) | n/a | n/a | ⬜ | Carving fallback |

> **Note:** Several vendors rebrand or share OEM hardware and firmware (for example, some CP Plus and Honeywell units are built on Dahua or Hikvision platforms). Parsers are grouped by underlying family to reduce effort. Support is only marked complete after validation on real images.

Legend: ⬜ not started · 🟨 in progress · ✅ validated

---

## 4. Key Features

| Module | Description |
|---|---|
| **Device Identification** | Fingerprints vendor and model from disk signatures, partition layout, and firmware strings |
| **Acquisition** | Read-only imaging (raw/dd, E01 input) with MD5 and SHA-256 hashing in a single streaming pass |
| **File System & Format Parsing** | Pluggable per-vendor parsers behind a common `BaseParser` interface |
| **Recovery** | Recovers deleted footage using file-system remnants and H.264/H.265 frame carving |
| **Decoding** | Converts proprietary containers to MP4 using FFmpeg |
| **Timeline Analysis** | UTC normalization (time zone, DST, clock drift) and cross-camera event correlation |
| **Machine Learning** | Motion, object (YOLO-class), and face detection |
| **Chain of Custody** | Hash-chained, append-only action log |
| **Reporting** | Standardized PDF/HTML reports with hashes, timelines, and findings |

---

## 5. Architecture

```
                 ┌─────────────────────────────┐
                 │        CLI / Web UI         │
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │   Case Manager + Custody    │
                 └──────────────┬──────────────┘
                                │
   ┌────────────┬───────────────┼──────────────┬─────────────┐
   ▼            ▼               ▼              ▼             ▼
Acquisition  Identify      Parsers         Recovery       Decode
(image+hash) (vendor/model) (per-vendor)  (carving)     (FFmpeg→MP4)
                                │
                 ┌──────────────▼──────────────┐
                 │  Timeline  →  Analytics(ML) │
                 └──────────────┬──────────────┘
                                ▼
                            Reporting
```

### Typical workflow

1. **Create case** → examiner and case details are recorded
2. **Acquire** → forensic image is created or ingested, MD5 and SHA-256 computed
3. **Identify** → vendor and model detected automatically
4. **Parse** → file system is read and recordings are indexed
5. **Recover** → deleted or unindexed footage is carved
6. **Decode** → footage is converted to standard video
7. **Timeline** → timestamps are normalized and events correlated
8. **Analyze** → motion, object, and face detection
9. **Report** → report generated and hashes re-verified

---

## 6. Project Structure

```
dvr-forensics/
├── core/          # hashing, custody log, config, case manager
├── acquisition/   # raw/E01 image reading, write-block checks
├── identify/      # vendor/model fingerprinting
├── parsers/       # base.py, hikvision.py, dahua.py, uniview.py, cpplus.py ...
├── recovery/      # frame carving (H.264/H.265 NAL / I-frame signatures)
├── decode/        # FFmpeg conversion to MP4
├── timeline/      # timestamp normalization, cross-camera correlation
├── analytics/     # motion, object, face detection
├── reporting/     # PDF/HTML report generator
├── ui/            # Streamlit (or PyQt) dashboard
├── tests/         # pytest unit and integration tests
├── docs/          # architecture, SOPs, validation, manuals, format notes
├── requirements.txt
└── README.md
```

---

## 7. Tech Stack

- **Language:** Python 3.11+
- **Disk and file system:** `pytsk3`, `dissect` (generic); custom parsers for proprietary formats
- **Video:** FFmpeg, PyAV, OpenCV
- **ML:** PyTorch / Ultralytics YOLO, a face detection model (e.g., InsightFace or OpenCV DNN)
- **Storage:** SQLite (case database)
- **Reporting:** ReportLab or WeasyPrint
- **UI:** Streamlit
- **Testing:** pytest

---

## 8. Installation

### Prerequisites

- Python 3.11 or newer
- [FFmpeg](https://ffmpeg.org/download.html) installed and on your `PATH`
- Git

### Setup

```bash
git clone <your-repo-url> dvr-forensics
cd dvr-forensics

python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 9. Usage (CLI)

DVRX provides a command-line interface via `dvrx` (or `python -m dvrx`):

```bash
# 1. Create a new forensic case (initializes database and genesis custody entry)
dvrx case new --id CASE-001 --examiner "Investigator Name" --notes "Seized DVR unit"

# 2. Acquire and hash an evidence image (read-only single-pass streaming MD5 & SHA-256)
dvrx acquire --case CASE-001 --source evidence.dd --examiner "Investigator Name"

# 3. Verify custody log chain integrity and re-verify evidence file hashes
dvrx case verify --case CASE-001
```

### Planned Subcommands (Phases 3–8)

```bash
# Identify the device (Phase 3)
dvrx identify --case CASE-001

# Parse and list recordings (Phase 5)
dvrx parse --case CASE-001

# Recover deleted footage (Phase 4)
dvrx recover --case CASE-001

# Build the timeline (Phase 6)
dvrx timeline --case CASE-001

# Run analytics (Phase 7)
dvrx analyze --case CASE-001 --motion --objects --faces

# Generate the report (Phase 8)
dvrx report --case CASE-001 --format pdf
```

---

## 10. Forensic Principles

1. **Read-only evidence:** source images and devices are never modified. Use a hardware write-blocker for physical drives.
2. **Integrity:** MD5 and SHA-256 are computed at acquisition and re-verified before reporting.
3. **Chain of custody:** every action is appended to a hash-chained log (each entry includes the previous entry's hash, examiner, timestamp, action, and file hash), so tampering is detectable.
4. **Time handling:** all timestamps are stored as UTC along with the original raw value and time-zone offset.
5. **Reproducibility:** the same input must always give the same output.
6. **Documentation:** unverified assumptions about proprietary formats are recorded in `docs/format_notes/`.

---

## 11. Roadmap

- [x] **Phase 1:** Core: streaming hasher, custody log, case manager, CLI (Completed)
- [ ] **Phase 2:** Acquisition: raw image reading and hash verification
- [ ] **Phase 3:** Device identification and `BaseParser` plugin architecture
- [ ] **Phase 4:** Generic frame carver (H.264/H.265)
- [ ] **Phase 5:** Vendor parsers (Hikvision, Dahua first, then others)
- [ ] **Phase 6:** Timeline normalization and cross-camera correlation
- [ ] **Phase 7:** Analytics (motion, object, face)
- [ ] **Phase 8:** Reporting and UI
- [ ] **Phase 9:** Validation, SOPs, user manual, final report

---

## 12. Testing and Validation

- Unit tests with `pytest` for every module (`pytest tests/`)
- Synthetic images for automated tests
- Validation with real DVR/NVR images using a known-ground-truth method:
  1. Record known footage on a DVR/NVR
  2. Delete part of it
  3. Image the disk and run the tool
  4. Measure recovery rate, timestamp accuracy, and hash consistency
- Results are documented in `docs/validation/`

---

## 13. Deliverables Checklist

- [ ] Comparative analysis of DVR/NVR OEMs
- [ ] DVR/NVR forensic images (test set)
- [ ] System architecture documentation
- [ ] Functional prototype
- [ ] Standard Operating Procedures (SOPs)
- [ ] Validation reports
- [ ] User manual
- [ ] Final project report

---

## 14. Legal and Ethical Notice

This tool is intended for lawful forensic examination only, by authorized personnel, on evidence they are permitted to examine. Always follow your organization's SOPs and the legal requirements of your jurisdiction. Results should be validated before being relied on as evidence.

---

## 15. Team

| Name | Role |
|---|---|
| _Your name_ | _Developer_ |
| _Guide / mentor_ | _Supervisor_ |

---

## 16. License

_Choose a license (for example MIT or Apache-2.0) and add a `LICENSE` file._
