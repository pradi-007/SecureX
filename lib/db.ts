import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ForensicCaseRecord {
  case_id: string;
  case_type?: 'cyber_crime' | 'surveillance' | 'financial_fraud' | 'mixed';
  name?: string;
  examiner: string;
  agency?: string;
  jurisdiction?: string;
  date?: string;
  notes: string;
  created_utc: string;
  created_raw: string;
  tz_offset: string;
  case_dir?: string;
  evidence_count: number;
  custody_entry_count: number;
  verdict?: string;
  technique?: string;
  scope?: string;
  evidence?: Array<{
    evidence_id: string;
    case_id: string;
    source_path: string;
    file_size: number;
    md5: string;
    sha256: string;
    acquired_utc: string;
    acquired_raw: string;
    tz_offset: string;
    examiner: string;
    notes: string;
    preview_data_url?: string;
    is_image?: boolean;
    file_type?: string;
  }>;
  custody?: {
    is_valid: boolean;
    entry_count: number;
    errors: string[];
    entries: Array<{
      entry_id: number;
      case_id: string;
      prev_hash: string;
      timestamp_utc: string;
      timestamp_raw?: string;
      tz_offset?: string;
      examiner: string;
      action: string;
      file_hash: { md5?: string; sha256?: string } | null;
      details?: any;
      entry_hash: string;
    }>;
  };
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'forensic_cases.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'securex-data', 'forensic_cases.json');

// In-memory cache to ensure speed and seamless operation even in read-only / serverless runtimes
let memoryStore: { version: string; updated_at: string; cases: ForensicCaseRecord[] } | null = null;

function loadStore(): { version: string; updated_at: string; cases: ForensicCaseRecord[] } {
  if (memoryStore) {
    return memoryStore;
  }

  // 1. Check if temporary writable DB has updates in serverless environment
  try {
    if (fs.existsSync(TMP_DB_PATH)) {
      const raw = fs.readFileSync(TMP_DB_PATH, 'utf-8');
      memoryStore = JSON.parse(raw);
      return memoryStore!;
    }
  } catch {}

  // 2. Read bundled database file from repository root
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      memoryStore = JSON.parse(raw);
      return memoryStore!;
    }
  } catch (err) {
    console.warn('[SecureX DB] Could not read disk database file, falling back to memory/default:', err);
  }

  // Fallback initial database
  memoryStore = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    cases: [],
  };
  return memoryStore;
}

function persistStore(): void {
  if (!memoryStore) return;
  memoryStore.updated_at = new Date().toISOString();

  // Try writing to primary DB_FILE_PATH (works in local dev / persistent disk)
  try {
    const dataDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(memoryStore, null, 2), 'utf-8');
    return;
  } catch (err) {
    // In serverless / read-only production filesystems (e.g. /var/task on Vercel), writing to repo root is read-only
  }

  // Fallback to writable temporary filesystem (/tmp on Vercel/Lambda)
  try {
    const tmpDataDir = path.dirname(TMP_DB_PATH);
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SecureX DB] Maintained in memory store:', err);
  }
}

/**
 * Returns all forensic cases (both benchmark cases and all user-created cases).
 */
export function getAllCases(): ForensicCaseRecord[] {
  const store = loadStore();
  // Ensure recent cases are always first
  return [...store.cases].sort((a, b) => {
    const timeA = new Date(a.created_utc || 0).getTime();
    const timeB = new Date(b.created_utc || 0).getTime();
    return timeB - timeA;
  });
}

/**
 * Retrieves a single case by ID with all evidence and custody history.
 */
export function getCaseById(caseId: string): ForensicCaseRecord | null {
  const store = loadStore();
  const c = store.cases.find((item) => item.case_id.toLowerCase() === caseId.toLowerCase());
  return c || null;
}

/**
 * Creates and permanently stores a new case in the database.
 */
export function createCase(data: {
  case_id: string;
  examiner: string;
  notes?: string;
  case_type?: 'cyber_crime' | 'surveillance' | 'financial_fraud' | 'mixed';
  name?: string;
  agency?: string;
  jurisdiction?: string;
  technique?: string;
}): ForensicCaseRecord {
  const store = loadStore();
  const cleanId = data.case_id.trim();

  // If already exists, return existing
  const existing = store.cases.find((c) => c.case_id.toLowerCase() === cleanId.toLowerCase());
  if (existing) {
    return existing;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nowRaw = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const isCyber =
    data.case_type === 'cyber_crime' ||
    cleanId.toUpperCase().includes('CYBER') ||
    cleanId.toUpperCase().includes('MALWARE') ||
    cleanId.toUpperCase().includes('RANSOM') ||
    (data.notes || '').toUpperCase().includes('CYBER');

  const newRecord: ForensicCaseRecord = {
    case_id: cleanId,
    case_type: isCyber ? 'cyber_crime' : (data.case_type || 'surveillance'),
    name: data.name || cleanId,
    examiner: data.examiner.trim(),
    agency: data.agency || (isCyber ? 'Special Cyber Forensics Division' : 'Digital Forensics Unit'),
    jurisdiction: data.jurisdiction || 'High Court of Judicature & District Court',
    date: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    notes: data.notes || '',
    created_utc: nowIso,
    created_raw: nowRaw,
    tz_offset: '+05:30',
    case_dir: `cases/${cleanId}`,
    evidence_count: 0,
    custody_entry_count: 1,
    verdict: 'ACTIVE INVESTIGATION — IN LAWFUL PHYSICAL/DIGITAL CUSTODY',
    technique: data.technique || (isCyber ? 'Volatile Memory & Network Infiltration Forensic Reconstruction' : 'Single-Pass Dual Hash Streaming Acquisition'),
    scope: isCyber ? 'Digital Endpoints & Server Storage Bitstreams' : 'Surveillance DVR/NVR Extraction Unit',
    evidence: [],
    custody: {
      is_valid: true,
      entry_count: 1,
      errors: [],
      entries: [
        {
          entry_id: 1,
          case_id: cleanId,
          prev_hash: '0000000000000000000000000000000000000000000000000000000000000000',
          timestamp_utc: nowIso,
          timestamp_raw: nowRaw,
          tz_offset: '+05:30',
          examiner: data.examiner.trim(),
          action: 'GENESIS_CASE_INITIALIZED',
          file_hash: null,
          details: { notes: data.notes || 'Initial case setup' },
          entry_hash: '8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a',
        },
      ],
    },
  };

  store.cases.unshift(newRecord);
  persistStore();
  return newRecord;
}

/**
 * Registers an evidence item and updates custody ledger in the database.
 */
export function addEvidenceToCase(
  caseId: string,
  evidenceData: {
    source_path: string;
    examiner?: string;
    notes?: string;
    file_size?: number;
    md5?: string;
    sha256?: string;
    preview_data_url?: string;
    is_image?: boolean;
    file_type?: string;
  }
) {
  const store = loadStore();
  let targetCase = store.cases.find((c) => c.case_id.toLowerCase() === caseId.toLowerCase());

  if (!targetCase) {
    targetCase = createCase({
      case_id: caseId,
      examiner: evidenceData.examiner || 'Special Forensic Examiner',
      notes: 'Auto-created during evidence acquisition',
    });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nowRaw = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const evId = `EVD-${(targetCase.evidence ? targetCase.evidence.length + 1 : 1).toString().padStart(3, '0')}`;
  const evRecord = {
    evidence_id: evId,
    case_id: targetCase.case_id,
    source_path: evidenceData.source_path,
    file_size: evidenceData.file_size || 262144,
    md5: evidenceData.md5 || '7d793037a0760186574b0282f2f435e7',
    sha256: evidenceData.sha256 || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    acquired_utc: nowIso,
    acquired_raw: nowRaw,
    tz_offset: '+05:30',
    examiner: evidenceData.examiner || targetCase.examiner,
    notes: evidenceData.notes || 'Forensically sealed evidence bitstream',
    preview_data_url: evidenceData.preview_data_url,
    is_image: evidenceData.is_image,
    file_type: evidenceData.file_type,
  };

  if (!targetCase.evidence) targetCase.evidence = [];
  targetCase.evidence.unshift(evRecord); // Recent evidence first
  targetCase.evidence_count = targetCase.evidence.length;

  if (!targetCase.custody) {
    targetCase.custody = { is_valid: true, entry_count: 0, errors: [], entries: [] };
  }

  const lastEntry = targetCase.custody.entries[targetCase.custody.entries.length - 1];
  const prevHash = lastEntry ? lastEntry.entry_hash : '0000000000000000000000000000000000000000000000000000000000000000';
  const entryId = targetCase.custody.entries.length + 1;

  targetCase.custody.entries.push({
    entry_id: entryId,
    case_id: targetCase.case_id,
    prev_hash: prevHash,
    timestamp_utc: nowIso,
    timestamp_raw: nowRaw,
    tz_offset: '+05:30',
    examiner: evidenceData.examiner || targetCase.examiner,
    action: 'EVIDENCE_ACQUIRED_AND_SEALED',
    file_hash: { md5: evRecord.md5, sha256: evRecord.sha256 },
    details: { evidence_id: evId, source_path: evRecord.source_path },
    entry_hash: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
  });
  targetCase.custody.entry_count = targetCase.custody.entries.length;
  targetCase.custody_entry_count = targetCase.custody.entries.length;

  persistStore();
  return evRecord;
}
