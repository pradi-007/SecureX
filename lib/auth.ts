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

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`dvrx_salt_${password.trim()}`).digest('hex');
}

// In-memory cache for high-speed lookups and durability across requests
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
    {
      user_id: '001',
      name: 'Special Examiner 001',
      agency: 'Digital Forensics & Cyber Intelligence',
      password_hash: hashPassword('001'),
      created_at: '2026-10-04T05:00:00Z',
    },
  ];
}

export function loadExaminersStore(): ExaminerRecord[] {
  if (examinersStore && examinersStore.length > 0) {
    return examinersStore;
  }

  const map = new Map<string, ExaminerRecord>();

  // 1. Seed defaults
  for (const init of getInitialExaminers()) {
    map.set(init.user_id.toLowerCase(), init);
  }

  // 2. Read bundled repo database
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.user_id && item?.password_hash) {
            map.set(item.user_id.toLowerCase(), item);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SecureX Auth] Could not read disk DB:', err);
  }

  // 3. Read writable serverless /tmp database
  try {
    if (fs.existsSync(TMP_DB_PATH)) {
      const raw = fs.readFileSync(TMP_DB_PATH, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item?.user_id && item?.password_hash) {
            map.set(item.user_id.toLowerCase(), item);
          }
        }
      }
    }
  } catch {}

  examinersStore = Array.from(map.values());
  persistExaminersStore();
  return examinersStore;
}

export function persistExaminersStore(): void {
  if (!examinersStore) return;

  const serialized = JSON.stringify(examinersStore, null, 2);

  // 1. Write to repo data/examiners.json (works locally and where persistent disk is available)
  try {
    const dataDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, serialized, 'utf-8');
  } catch {
    // Read-only filesystem in serverless container
  }

  // 2. Write to serverless /tmp directory
  try {
    const tmpDataDir = path.dirname(TMP_DB_PATH);
    if (!fs.existsSync(tmpDataDir)) {
      fs.mkdirSync(tmpDataDir, { recursive: true });
    }
    fs.writeFileSync(TMP_DB_PATH, serialized, 'utf-8');
  } catch (err) {
    console.warn('[SecureX Auth] Maintained in memory store:', err);
  }
}

/**
 * Syncs an array of external examiner records (e.g. from browser client vault)
 * into the server store so no account is lost on cold serverless starts.
 */
export function syncExaminers(externalRecords: ExaminerRecord[]): void {
  if (!Array.isArray(externalRecords) || externalRecords.length === 0) return;
  const store = loadExaminersStore();
  let updated = false;

  for (const rec of externalRecords) {
    if (!rec?.user_id || !rec?.password_hash) continue;
    const cleanId = rec.user_id.trim();
    const idx = store.findIndex((u) => u.user_id.toLowerCase() === cleanId.toLowerCase());

    if (idx >= 0) {
      // Keep existing or update if external record is newer
      if (rec.password_hash && store[idx].password_hash !== rec.password_hash) {
        store[idx].password_hash = rec.password_hash;
        updated = true;
      }
    } else {
      store.push({
        user_id: cleanId,
        name: rec.name?.trim() || cleanId,
        agency: rec.agency?.trim() || 'Special Cyber Crime Investigation Wing',
        password_hash: rec.password_hash,
        created_at: rec.created_at || new Date().toISOString(),
      });
      updated = true;
    }
  }

  if (updated) {
    persistExaminersStore();
  }
}

/**
 * Registers a new forensic examiner account, or updates existing account password if re-registering.
 */
export function registerExaminer(data: {
  user_id: string;
  password: string;
  name?: string;
  agency?: string;
}): { success: boolean; message?: string; examiner?: ExaminerProfile; record?: ExaminerRecord } {
  const store = loadExaminersStore();
  const cleanId = data.user_id.trim();

  if (!cleanId) {
    return { success: false, message: 'Examiner Node ID is required.' };
  }

  if (!data.password || data.password.trim().length < 3) {
    return { success: false, message: 'Sequence key must be at least 3 characters long.' };
  }

  const existingIdx = store.findIndex((u) => u.user_id.toLowerCase() === cleanId.toLowerCase());
  const newHash = hashPassword(data.password);

  if (existingIdx >= 0) {
    // Update existing examiner credentials seamlessly
    store[existingIdx].password_hash = newHash;
    if (data.name?.trim()) store[existingIdx].name = data.name.trim();
    if (data.agency?.trim()) store[existingIdx].agency = data.agency.trim();
    persistExaminersStore();

    return {
      success: true,
      message: 'Examiner registered successfully.',
      examiner: {
        user_id: store[existingIdx].user_id,
        name: store[existingIdx].name,
        agency: store[existingIdx].agency,
        created_at: store[existingIdx].created_at,
      },
      record: store[existingIdx],
    };
  }

  const newRecord: ExaminerRecord = {
    user_id: cleanId,
    name: data.name?.trim() || cleanId,
    agency: data.agency?.trim() || 'Special Cyber Crime Investigation Wing',
    password_hash: newHash,
    created_at: new Date().toISOString(),
  };

  store.push(newRecord);
  persistExaminersStore();

  return {
    success: true,
    message: 'Examiner registered successfully.',
    examiner: {
      user_id: newRecord.user_id,
      name: newRecord.name,
      agency: newRecord.agency,
      created_at: newRecord.created_at,
    },
    record: newRecord,
  };
}

/**
 * Authenticates an existing forensic examiner, with client vault sync.
 */
export function authenticateExaminer(data: {
  user_id: string;
  password: string;
  client_vault?: ExaminerRecord[];
}): { success: boolean; message?: string; examiner?: ExaminerProfile; record?: ExaminerRecord } {
  // Sync client vault first to restore any accounts created in the browser across serverless instances
  if (data.client_vault && Array.isArray(data.client_vault)) {
    syncExaminers(data.client_vault);
  }

  const store = loadExaminersStore();
  const cleanId = data.user_id.trim();
  const incomingHash = hashPassword(data.password);

  let matched = store.find((u) => u.user_id.toLowerCase() === cleanId.toLowerCase());

  // Fallback: check directly in incoming client vault
  if (!matched && data.client_vault && Array.isArray(data.client_vault)) {
    const vaultMatch = data.client_vault.find(
      (v) => v.user_id && v.user_id.toLowerCase() === cleanId.toLowerCase()
    );
    if (vaultMatch) {
      store.push(vaultMatch);
      persistExaminersStore();
      matched = vaultMatch;
    }
  }

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
    record: matched,
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
