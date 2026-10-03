import { NextRequest, NextResponse } from 'next/server';
import { runDvrxBridge } from '@/lib/dvrx-bridge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('case_id');
  const evidenceId = searchParams.get('evidence_id');

  try {
    if (caseId && evidenceId) {
      const data = await runDvrxBridge('inspect_evidence', { case_id: caseId, evidence_id: evidenceId });
      return NextResponse.json(data);
    } else if (caseId) {
      const data = await runDvrxBridge('get_case', { case_id: caseId });
      return NextResponse.json(data);
    } else {
      const data = await runDvrxBridge('list_cases');
      return NextResponse.json(data);
    }
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (!action) {
      return NextResponse.json({ status: 'error', message: 'Missing action field' }, { status: 400 });
    }

    if (action === 'create_case') {
      const data = await runDvrxBridge('create_case', {
        case_id: body.case_id,
        examiner: body.examiner,
        notes: body.notes || '',
      });
      return NextResponse.json(data);
    } else if (action === 'acquire_evidence') {
      const data = await runDvrxBridge('acquire_evidence', {
        case_id: body.case_id,
        source_path: body.source_path,
        examiner: body.examiner,
        notes: body.notes || '',
      });
      return NextResponse.json(data);
    } else if (action === 'verify_case') {
      const data = await runDvrxBridge('verify_case', {
        case_id: body.case_id,
        examiner: body.examiner,
      });
      return NextResponse.json(data);
    } else if (action === 'inspect_evidence') {
      const data = await runDvrxBridge('inspect_evidence', {
        case_id: body.case_id,
        evidence_id: body.evidence_id,
      });
      return NextResponse.json(data);
    } else if (action === 'generate_sample_evidence') {
      const fs = await import('fs/promises');
      const path = await import('path');
      const evidenceDir = path.resolve(process.cwd(), 'evidence');
      await fs.mkdir(evidenceDir, { recursive: true });
      const filename = `cctv_ch1_${Date.now()}.dd`;
      const filePath = path.join(evidenceDir, filename);
      const block = Buffer.from('DVRX_SYNTHETIC_H264_NAL_SURVEILLANCE_STREAM_RECORDING_BLOCK_00\\x00\\x00\\x01\\x67\\x42\\x00\\x1e');
      const fullBuffer = Buffer.alloc(256 * 1024);
      for (let offset = 0; offset < fullBuffer.length; offset += block.length) {
        block.copy(fullBuffer, offset, 0, Math.min(block.length, fullBuffer.length - offset));
      }
      await fs.writeFile(filePath, fullBuffer);

      const data = await runDvrxBridge('acquire_evidence', {
        case_id: body.case_id,
        source_path: filePath,
        examiner: body.examiner,
        notes: body.notes || `Generated synthetic surveillance sample (${filename})`,
      });
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ status: 'error', message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
