import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export interface ExaminerRecord {
  user_id: string;
  name: string;
  agency: string;
  password_hash: string;
  created_at: string;
}

export interface ExaminerProfile {
  user_id: string;
  name: string;
  agency: string;
  created_at: string;
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'data', 'examiners.json');
const TMP_DB_PATH = path.join(os.tmpdir(), 'securex-data', 'examiners.json');

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`dvrx_salt_${password.trim()}`).digest('hex');
}

// In-memory cache for high-speed lookups and serverless durability
let examinersStore: ExaminerRecord[] | null = null;

function getInitialExaminers(): ExaminerRecord[] {
  return [
    {
      user_id: 'EXAMINER-DVRX-01',
      name: 'Special Cyber Forensic Specialist',
      agency: 'National Digital Forensics & Cyber Command',
      password_hash: hashPassword('dvrx@2026'),
      created_at: '2026-10-04T05:00:00Z',
    },
    {
      user_id: 'ADMIN',
      name: 'Lead Forensics Director',
      agency: 'Cyber Crime Investigation Bureau',
      password_hash: hashPassword('dvrx@2026'),
      created_at: '2026-10-04T05:00:00Z',
    },
  ];
}

function loadExaminersStore(): ExaminerRecord[] {
  if (examinersStore) {
    return examinersStore;
  }

  // 1. Try reading from temporary writable filesystem in serverless environments
  try {
    if (fs.existsSync(TMP_DB_PATH)) {
      const raw = fs.readFileSync(TMP_DB_PATH, 'utf-8');
      examinersStore = JSON.parse(raw);
      return examinersStore!;
    }
  } catch {}

  // 2. Try reading from repository data/examiners.json
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      examinersStore = JSON.parse(raw);
      return examinersStore!;
    }
  } catch (err) {
    console.warn('[SecureX Auth] Could not read disk examiners file, using default seeds:', err);
  }

  examinersStore = getInitialExaminers();
  persistExaminersStore();
  return examinersStore;
}

function persistExaminersStore(): void {
  if (!examinersStore) return;

  // Try local repository path
  try {
    const dataDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(examinersStore, null, 2), 'utf-8');
    return;
  } catch {
    // Read-only filesystem in serverless production
  }

  // Fallback to serverless temporary directory
  try {
    const tmpDataDir = path.dirname(TMP_DB_PATH);
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    fs.writeFileSync(TMP_DB_PATH, JSON.stringify(examinersStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SecureX Auth] Maintained in memory store:', err);
  }
}

/**
 * Registers a new forensic examiner account.
 */
export function registerExaminer(data: {
  user_id: string;
  password: string;
  name?: string;
  agency?: string;
}): { success: boolean; message?: string; examiner?: ExaminerProfile } {
  const store = loadExaminersStore();
  const cleanId = data.user_id.trim();

  if (!cleanId) {
    return { success: false, message: 'Examiner Node ID is required.' };
  }

  if (!data.password || data.password.trim().length < 4) {
    return { success: false, message: 'Sequence key must be at least 4 characters long.' };
  }

  // Check if Examiner ID already exists (case-insensitive)
  const existing = store.find((u) => u.user_id.toLowerCase() === cleanId.toLowerCase());
  if (existing) {
    return {
      success: false,
      message: `Examiner ID "${cleanId}" is already registered. Please access login or choose a different ID.`,
    };
  }

  const newRecord: ExaminerRecord = {
    user_id: cleanId,
    name: data.name?.trim() || cleanId,
    agency: data.agency?.trim() || 'Special Cyber Crime Investigation Wing',
    password_hash: hashPassword(data.password),
    created_at: new Date().toISOString(),
  };

  store.push(newRecord);
  persistExaminersStore();

  return {
    success: true,
    examiner: {
      user_id: newRecord.user_id,
      name: newRecord.name,
      agency: newRecord.agency,
      created_at: newRecord.created_at,
    },
  };
}

/**
 * Authenticates an existing forensic examiner.
 */
export function authenticateExaminer(data: {
  user_id: string;
  password: string;
}): { success: boolean; message?: string; examiner?: ExaminerProfile } {
  const store = loadExaminersStore();
  const cleanId = data.user_id.trim();
  const incomingHash = hashPassword(data.password);

  const matched = store.find((u) => u.user_id.toLowerCase() === cleanId.toLowerCase());
  if (!matched) {
    return { success: false, message: `Examiner ID "${cleanId}" not found. Please register an account.` };
  }

  if (matched.password_hash !== incomingHash) {
    return { success: false, message: 'Invalid sequence key / password entered.' };
  }

  return {
    success: true,
    examiner: {
      user_id: matched.user_id,
      name: matched.name,
      agency: matched.agency,
      created_at: matched.created_at,
    },
  };
}

/**
 * Lists public examiner profiles (excluding password hashes).
 */
export function listExaminers(): ExaminerProfile[] {
  const store = loadExaminersStore();
  return store.map((u) => ({
    user_id: u.user_id,
    name: u.name,
    agency: u.agency,
    created_at: u.created_at,
  }));
}
