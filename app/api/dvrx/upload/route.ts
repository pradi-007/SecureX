import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { runDvrxBridge } from '@/lib/dvrx-bridge';

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

    const evidenceDir = path.resolve(process.cwd(), 'evidence');
    await fs.mkdir(evidenceDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const destPath = path.join(evidenceDir, file.name);

    await fs.writeFile(destPath, buffer);

    const data = await runDvrxBridge('acquire_evidence', {
      case_id: caseId,
      source_path: destPath,
      examiner: examiner || undefined,
      notes: notes || `Uploaded via Web UI (${file.name})`,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
