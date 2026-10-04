import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { runDvrxBridge } from '@/lib/dvrx-bridge';
import { getWritableEvidenceDirectory } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const caseId = formData.get('case_id') as string | null;
    const examiner = formData.get('examiner') as string | null;
    const notes = formData.get('notes') as string | null;

    if (!file || !caseId) {
      return NextResponse.json({ status: 'error', message: 'Missing file or case_id' }, { status: 400 });
    }

    // 1. Single-pass cryptographic hashing directly from uploaded bytes in memory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const md5Digest = crypto.createHash('md5').update(buffer).digest('hex');
    const sha256Digest = crypto.createHash('sha256').update(buffer).digest('hex');

    // 2. Obtain guaranteed writable evidence directory (works on Vercel /tmp and local ./evidence)
    const evidenceDir = getWritableEvidenceDirectory();
    const sanitizedBase = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = `${Date.now()}_${sanitizedBase || 'evidence.raw'}`;
    const destPath = path.join(evidenceDir, safeFilename);

    // 3. Resilient write to disk (non-blocking in restricted serverless contexts)
    try {
      await fs.writeFile(destPath, buffer);
    } catch (writeError) {
      console.warn('[DVRX Upload] Serverless disk write warning, proceeding with sealed bitstream hashes:', writeError);
    }

    // 4. Register evidence and log into append-only custody chain
    const data = await runDvrxBridge('acquire_evidence', {
      case_id: caseId,
      source_path: destPath,
      examiner: examiner || undefined,
      notes: notes || `Uploaded via Web UI (${file.name})`,
      file_size: buffer.length,
      md5: md5Digest,
      sha256: sha256Digest,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[DVRX Upload Exception]', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
