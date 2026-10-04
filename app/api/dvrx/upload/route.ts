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

    // 2. Detect if the uploaded evidence is an image (crime scene photo, CCTV snapshot, screenshot)
    const ext = path.extname(file.name).toLowerCase();
    const isImage =
      (Boolean(file.type) && file.type.startsWith('image/')) ||
      ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'].includes(ext);

    let previewDataUrl: string | undefined = undefined;
    if (isImage) {
      const mime =
        file.type ||
        (ext === '.png'
          ? 'image/png'
          : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
          ? 'image/webp'
          : ext === '.svg'
          ? 'image/svg+xml'
          : 'image/jpeg');

      // For images up to 10 MB, generate inline base64 data URL for direct, instant preview in any browser/serverless environment
      if (buffer.length <= 10 * 1024 * 1024) {
        previewDataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }

    // 3. Obtain guaranteed writable evidence directory (works on Vercel /tmp and local ./evidence)
    const evidenceDir = getWritableEvidenceDirectory();
    const sanitizedBase = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = `${Date.now()}_${sanitizedBase || 'evidence.raw'}`;
    const destPath = path.join(evidenceDir, safeFilename);

    // 4. Resilient write to disk (non-blocking in restricted serverless contexts)
    try {
      await fs.writeFile(destPath, buffer);
    } catch (writeError) {
      console.warn('[DVRX Upload] Serverless disk write warning, proceeding with sealed bitstream hashes:', writeError);
    }

    // 5. Register evidence and log into append-only custody chain
    const data = await runDvrxBridge('acquire_evidence', {
      case_id: caseId,
      source_path: destPath,
      examiner: examiner || undefined,
      notes: notes || `Uploaded via Web UI (${file.name})`,
      file_size: buffer.length,
      md5: md5Digest,
      sha256: sha256Digest,
      preview_data_url: previewDataUrl,
      is_image: isImage,
      file_type: file.type || ext,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[DVRX Upload Exception]', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
