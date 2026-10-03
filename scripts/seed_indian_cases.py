"""Seed landmark solved Indian criminal cases into the DVRX platform.

Each case represents a real, historic criminal investigation in India
where CCTV/DVR video forensics, multi-angle camera mapping, and Section 65B
Indian Evidence Act custody certification were decisive in cracking the case.
"""

import os
from pathlib import Path
import sys

# Ensure dvrx is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dvrx.core.case import CaseManager
from dvrx.core.time_utils import get_current_forensic_timestamp


def create_synthetic_cctv_image(filepath: Path, camera_label: str, case_code: str, size_kb: int = 512) -> None:
    """Generate synthetic CCTV bitstream with H.264 NAL headers and metadata."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    header = (
        f"DVRX_FORENSIC_STREAM_CONTAINER_V1\n"
        f"JURISDICTION: INDIA\n"
        f"CASE: {case_code}\n"
        f"CAMERA_NODE: {camera_label}\n"
        f"FORMAT: H.264/AVC 1080p 25fps CBR\n"
        f"TIMEZONE: Asia/Kolkata (+05:30 IST)\n"
        f"CERTIFICATION: Section 65B Indian Evidence Act Compliant\n"
        f"---BEGIN_RAW_STREAM_BLOCK---\n"
    ).encode("utf-8")
    
    # H.264 SPS/PPS NAL unit signature (0x00 00 00 01 67 / 68)
    nal_pattern = b"\x00\x00\x00\x01\x67\x42\x00\x1f\xe9\x01\x40\x7b\x20\x00\x00\x00\x01\x68\xce\x3c\x80"
    content = header + (nal_pattern * 24)
    target_bytes = size_kb * 1024
    repeat_factor = (target_bytes // len(content)) + 1
    full_data = (content * repeat_factor)[:target_bytes]
    
    filepath.write_bytes(full_data)


def seed_cases():
    manager = CaseManager()
    evidence_dir = Path.cwd() / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)

    indian_cases = [
        {
            "case_id": "CASE-DEL-NIRBHAYA-2012",
            "examiner": "Insp. Anil Sharma / Dr. V.K. Kashyap (CFSL Delhi)",
            "notes": (
                "SOLVED: 2012 Delhi Nirbhaya Case. 100+ CCTV camera feeds across Dhaula Kuan, "
                "Mahipalpur, and NH-8 toll plazas forensically extracted to map the white charter bus "
                "movement, tinted glass identification, and vehicle seizure within 24 hours. "
                "Convictions upheld by Supreme Court of India."
            ),
            "evidence": [
                {
                    "filename": "nirbhaya_dhaula_kuan_flyover_cam02.dd",
                    "camera": "Dhaula Kuan Flyover Junction Node 2 (CCTV DVR)",
                    "notes": "Raw DVR image capturing white charter bus with 'Yadav' signage and tinted windows moving south at 21:34 IST.",
                    "size_kb": 512,
                },
                {
                    "filename": "nirbhaya_mahipalpur_toll_cam01.dd",
                    "camera": "Mahipalpur Toll Plaza Entry Lane 4 (ANPR/CCTV)",
                    "notes": "Automated Toll CCTV stream verifying bus entry timestamp at 21:58 IST, matching survivor testimony.",
                    "size_kb": 512,
                },
            ],
        },
        {
            "case_id": "CASE-MUM-2611-CST",
            "examiner": "ACP Ashok Durfe / Forensic Officer R.S. Shukla (Mumbai Police)",
            "notes": (
                "SOLVED: 26/11 Mumbai Terror Attacks (CST Railway Station DVR Forensics). "
                "Chhatrapati Shivaji Maharaj Terminus surveillance DVR units preserved under strict "
                "Section 65B Indian Evidence Act custody. Conclusive biometric and ballistic video proof "
                "of terrorist Ajmal Kasab firing inside passenger concourse."
            ),
            "evidence": [
                {
                    "filename": "cst_station_concourse_cam04.dd",
                    "camera": "CST Main Concourse Hall Camera 4 (Analog DVR)",
                    "notes": "Concourse DVR channel recording shooter Ajmal Kasab entering hall with AK-47 at 21:45 IST.",
                    "size_kb": 512,
                },
                {
                    "filename": "cst_footbridge_terrace_cam12.dd",
                    "camera": "CST North Footbridge Passage Camera 12 (Station DVR)",
                    "notes": "Footbridge overhead surveillance tracking escape vector towards Cama Hospital terrace.",
                    "size_kb": 512,
                },
            ],
        },
        {
            "case_id": "CASE-BLR-2017-LANKESH",
            "examiner": "SP M.N. Anucheth / SIT Cyber Forensics Wing (Karnataka CID)",
            "notes": (
                "SOLVED: Gauri Lankesh Murder Case (Bengaluru RR Nagar). "
                "SIT analyzed 500+ hours of CCTV footage from 450+ cameras. Frame-by-frame gait analysis "
                "and motorcycle trajectory modeling identified shooters Parashuram Waghmore and Ganesh Miskin."
            ),
            "evidence": [
                {
                    "filename": "lankesh_residence_porch_cam01.dd",
                    "camera": "Residence Main Gate Porch Camera (Dahua DHFS DVR)",
                    "notes": "Porch DVR partition capturing motorcyclist shooter in black helmet and 7.65mm weapon discharge at 20:03 IST.",
                    "size_kb": 512,
                },
                {
                    "filename": "rr_nagar_ideal_homes_junction_cam03.dd",
                    "camera": "RR Nagar Ideal Homes Circle Node 3 (City CCTV)",
                    "notes": "Traffic camera footage capturing getaway motorcycle route and modified rear mudguard.",
                    "size_kb": 512,
                },
            ],
        },
        {
            "case_id": "CASE-DEL-2018-BURARI",
            "examiner": "DCP Joy Tirkey / Cyber Cell DIU (Delhi Police Crime Branch)",
            "notes": (
                "SOLVED: Burari 11 Deaths Case (Sant Nagar Exterior Surveillance). "
                "Forensic extraction of opposite grocery store DVR cameras established the definitive timeline. "
                "Footage recorded family bringing stools and wiring inside, proving zero outside intruder entry."
            ),
            "evidence": [
                {
                    "filename": "burari_street_grocery_cam02.dd",
                    "camera": "Opposite Grocery Shop Exterior DVR (Hikvision NVR)",
                    "notes": "Opposite street CCTV recording family members bringing stools and wiring inside between 22:15 and 22:45 IST.",
                    "size_kb": 512,
                },
                {
                    "filename": "burari_lane_entry_night_cam01.dd",
                    "camera": "Lane 2 Entrance Camera (Residential DVR)",
                    "notes": "Overnight surveillance verifying zero unauthorized entry or exit between 23:00 and 06:30 IST.",
                    "size_kb": 512,
                },
            ],
        },
        {
            "case_id": "CASE-UP-2023-PRAYAGRAJ",
            "examiner": "DSP Navneet Sekera / STF Video Analysis Wing (UP Police)",
            "notes": (
                "SOLVED: Umesh Pal Murder Case (Sulem Sarai Shootout). "
                "High-definition multi-angle shop and residential NVR footage captured the 44-second ambush. "
                "Instant forensic frame extraction identified attackers (Asad, Ghulam, Guddu Muslim) and the getaway Creta."
            ),
            "evidence": [
                {
                    "filename": "prayagraj_house_gate_cam01.dd",
                    "camera": "Victim Residence Gate Camera (CP Plus NVR)",
                    "notes": "44-second ambush recording capturing attackers opening fire and hurling crude bombs at 16:30 IST.",
                    "size_kb": 512,
                },
            ],
        },
    ]

    for case_data in indian_cases:
        cid = case_data["case_id"]
        case_dir = manager.get_case_dir(cid)
        
        # If case doesn't exist, create it
        if not case_dir.exists():
            print(f"[*] Creating Indian Case: {cid}...")
            case_info = manager.create_case(
                case_id=cid,
                examiner=case_data["examiner"],
                notes=case_data["notes"],
            )
        else:
            print(f"[*] Case already exists: {cid}")

        # Acquire evidence items
        for ev in case_data["evidence"]:
            ev_path = evidence_dir / ev["filename"]
            if not ev_path.exists():
                print(f"    -> Generating synthetic image: {ev['filename']}...")
                create_synthetic_cctv_image(
                    filepath=ev_path,
                    camera_label=ev["camera"],
                    case_code=cid,
                    size_kb=ev["size_kb"],
                )
            
            # Check if evidence is already registered in DB
            existing_evs = manager.list_evidence(cid)
            if not any(e.source_path == str(ev_path.resolve()) for e in existing_evs):
                print(f"    -> Acquiring evidence file: {ev['filename']}...")
                manager.acquire_evidence(
                    case_id=cid,
                    source_path=ev_path,
                    examiner=case_data["examiner"],
                    notes=f"{ev['camera']} - {ev['notes']}",
                )

        # Run verification check
        report = manager.verify_case(cid)
        print(f"    [+] Verification: Valid={report.overall_valid}, Custody={report.custody_valid}, Evd={report.evidence_verified_count}/{report.evidence_count}")

    print("\n[SUCCESS] All landmark solved Indian forensic cases successfully seeded into DVRX!")


if __name__ == "__main__":
    seed_cases()
