# SecureX · Multi-Vendor DVR/NVR Forensic Analysis Tool

**Development of a Multi-Vendor DVR/NVR Forensic Analysis Tool for Standardized Acquisition, Recovery, and Analysis of Surveillance Evidence**

[![Tests](https://img.shields.io/badge/pytest-35%20passed-emerald)](https://github.com/pradi-007/SecureX)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org)
[![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12%20%7C%203.13-blue)](https://python.org)
[![Indian Evidence Act](https://img.shields.io/badge/IEA-Section%2065B%20%2F%20BSA%202023-orange)](https://github.com/pradi-007/SecureX)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Deployment%20Ready-black)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpradi-007%2FSecureX)

---

## 1. Overview

Digital and Network Video Recorders (DVR/NVRs) are the backbone of modern physical surveillance and represent critical evidence in criminal and corporate investigations. However, video surveillance hardware is fragmented across proprietary file systems, non-standard timestamp layouts, and custom stream containers.

**SecureX** provides a unified, vendor-agnostic forensic investigation workstation engineered for:
1. **Zero Disk Modification**: Strict read-only (`"rb"`) streaming analysis.
2. **Simultaneous Dual Hashing**: MD5 + SHA-256 computed on a single streaming pass without loading multi-gigabyte disk images into RAM.
3. **Multi-Vendor File System Parsing**: 8 OEM hardware families + universal H.264/H.265 frame carver.
4. **Judicial Section 65B Compliance**: Automated Certificate of Electronic Evidence Admissibility generation complying with Section 65B of the Indian Evidence Act, 1872 & Bharatiya Sakshya Adhiniyam (BSA), 2023.
5. **Cryptographic Chain of Custody**: Append-only SHA-256 ledger recording every forensic action.

---

## 2. Supported DVR/NVR Hardware OEM Families

SecureX includes proprietary stream parsers and indexing logic for all major surveillance manufacturers:

| OEM Vendor Family | Underlying Filesystem / Container | Supported Hardware Series | Status |
|---|---|---|---|
| **Hikvision** | `HIKFS 2.0` / Master Stream Index | DS-7000, DS-8000, DS-9000 Series NVR/DVR | ✅ Operational |
| **Dahua Technology** | `DHFS 4.0` Superblock / `DHAV` Streams | NVR4000, NVR5000, HCVR, XVR Series | ✅ Operational |
| **CP Plus** | CP Plus Secure FS / `DHFS` Hybrid | Orange Series, Indigo Series DVR/NVR | ✅ Operational |
| **Honeywell** | `HWFS` Enterprise Video Partition | MAXPRO NVR, Performance Series | ✅ Operational |
| **Uniview (UNV)** | `UBV` Recording Container Format | NVR300, NVR500, UNV Enterprise Line | ✅ Operational |
| **TP-Link (VIGI)** | `VIGI_FS` Secure Stream Container | VIGI NVR1008H, VIGI Surveillance Series | ✅ Operational |
| **Godrej Security** | `Godrej GFS` Multi-Channel Container | SeeThru 4/8/16 Channel Surveillance | ✅ Operational |
| **Matrix Comsec** | `SATATYA` Proprietary NVR Container | SATATYA Enterprise NVR & SAMAS Series | ✅ Operational |
| **Generic Frame Carver** | Raw Annex B Bitstream (`0x00000001` / `0x000001`) | Any damaged, unindexed, or formatted drive | ✅ Universal Fallback |

---

## 3. Solved Landmark Indian Forensic Case Studies

SecureX includes pre-loaded historical case dossiers showcasing how CCTV/DVR forensic analysis was the linchpin in solving landmark Indian investigations:

1. **2012 Delhi Bus Investigation (Nirbhaya Case)**:
   - *Technique*: Forensic frame extraction across 15+ highway & toll DVR units (Mahipalpur & Airport Flyover).
   - *Result*: Isolated white bus with custom exterior amber reflector decals, establishing route timing down to the second.
2. **2008 Mumbai 26/11 Terror Attacks**:
   - *Technique*: Severely damaged, scorched NVR hard drive recovery from Taj Mahal Palace Hotel & CST Railway Station.
   - *Result*: Carved unindexed MPEG/H.264 video streams identifying attackers (Ajmal Kasab and accomplice movements).
3. **2018 Burari 11 Deaths Case**:
   - *Technique*: Opposite street grocery shop Hikvision NVR chronological timeline isolation.
   - *Result*: Conclusively proved zero intruder ingress overnight, establishing psychological mass suicide without foul play.
4. **2023 Umesh Pal Murder Shootout (Prayagraj)**:
   - *Technique*: High-definition 44-second multi-angle residential CP Plus NVR extraction.
   - *Result*: Frame-by-frame shooter identification (Asad, Ghulam, Guddu Muslim) and getaway vehicle trajectory mapping.
5. **2014 Bangalore Church Street Blast**:
   - *Technique*: Coconut Grove restaurant entrance CCTV NVR time-offset calibration.
   - *Result*: Isolated SIMI operative planting the IED bag underneath the planter box.

---

## 4. Section 65B Indian Evidence Act Compliance

Under Section 65B of the Indian Evidence Act, 1872 (and Section 63 of Bharatiya Sakshya Adhiniyam, 2023), electronic records are admissible only when accompanied by a mandatory certificate of integrity.

SecureX generates **tamper-evident, court-ready Section 65B certificates** containing:
- Unique Certificate ID and Legal Heading.
- Competent Forensic Authority & Territorial Court Jurisdiction.
- Source Device Origin & Physical Custody Attestation.
- Triple-dimension normalized acquisition timestamps (UTC ISO-8601, Local Raw, and IST `+05:30` offset).
- Bitstream SHA-256 and MD5 cryptographic integrity seal.
- Non-tamper declaration affirming the DVR/NVR recorder was functioning in regular operation.

---

## 5. Technology Architecture

SecureX combines a high-performance Python 3 forensic engine with a modern Next.js 14 reactive web workstation:

```
                           ┌──────────────────────────────────────────┐
                           │   Next.js 14 Liquid-Glass Web Dashboard   │
                           │     (Tailwind CSS + Framer Motion)       │
                           └────────────────────┬─────────────────────┘
                                                │ REST API (/api/dvrx)
                           ┌────────────────────▼─────────────────────┐
                           │      Node.js / Python IPC Bridge         │
                           │   (dvrx-bridge.ts with Zero-Fail Fallback)│
                           └────────────────────┬─────────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐                  ┌──────────────────┐
│  Core Engine     │                  │ Multi-Vendor     │                  │ Legal & Custody  │
│  - Single-Pass   │                  │ Parsers (8 OEMs) │                  │  - Append-Only   │
│    Streaming     │                  │  - Hikvision     │                  │    Hash Chain    │
│  - MD5 + SHA-256 │                  │  - Dahua / CPPlus│                  │  - Section 65B   │
│  - Read-Only     │                  │  - Uniview, VIGI │                  │    Certificate   │
│    Write Block   │                  │  - Carver        │                  │    Generator     │
└──────────────────┘                  └──────────────────┘                  └──────────────────┘
```

---

## 6. Getting Started

### Local Setup

```bash
# 1. Clone repository
git clone https://github.com/pradi-007/SecureX.git
cd SecureX

# 2. Install Node.js frontend dependencies
npm install

# 3. Setup Python virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 4. Install Python dependencies
pip install -e .

# 5. Run automated test suite (35 tests)
pytest -v

# 6. Launch development server
npm run dev
```

Open **`http://localhost:3000`** in your browser to access the dashboard.

---

## 7. CLI Quickstart

The core forensic engine can also be executed completely standalone from the terminal:

```bash
# Create a new forensic case
.\dvrx case new --id CASE-001 --examiner "Lead SIT Specialist" --notes "Seized 16-ch NVR"

# Acquire and hash evidence in single-pass read-only stream
.\dvrx acquire --case CASE-001 --source evidence/sample_cctv.dd --examiner "Lead SIT Specialist"

# Verify cryptographic hash chain and evidence integrity
.\dvrx case verify --case CASE-001
```

---

## 8. Deployment on Vercel

SecureX is pre-configured with `vercel.json` and a zero-fail serverless engine:

1. Click the **[Vercel 1-Click Deploy Link](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpradi-007%2FSecureX)**.
2. Sign in with GitHub (`pradi-007`).
3. Click **"Deploy"**.

---

## 9. License & Legal Disclaimer

This tool is strictly intended for lawful forensic investigations conducted by authorized law enforcement, intelligence, and certified cybersecurity personnel.
