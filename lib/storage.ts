import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Returns a guaranteed writable directory for evidence storage.
 * Works seamlessly across:
 * - Local development (Windows/macOS/Linux): `./evidence`
 * - Vercel / AWS Lambda Serverless: `/tmp/evidence` (guaranteed writable)
 */
export function getWritableEvidenceDirectory(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );

  if (isServerless) {
    const tmpEvidenceDir = path.join(os.tmpdir(), 'evidence');
    try {
      if (!fs.existsSync(tmpEvidenceDir)) {
        fs.mkdirSync(tmpEvidenceDir, { recursive: true });
      }
      return tmpEvidenceDir;
    } catch {
      return os.tmpdir();
    }
  }

  // Local development: try process.cwd()/evidence
  try {
    const localDir = path.resolve(process.cwd(), 'evidence');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(localDir, `.write_check_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return localDir;
  } catch {
    // If process.cwd() is read-only for any reason, fallback to os.tmpdir()
    const tmpEvidenceDir = path.join(os.tmpdir(), 'evidence');
    try {
      if (!fs.existsSync(tmpEvidenceDir)) {
        fs.mkdirSync(tmpEvidenceDir, { recursive: true });
      }
      return tmpEvidenceDir;
    } catch {
      return os.tmpdir();
    }
  }
}
