import { NextRequest, NextResponse } from 'next/server';
import { runDvrxBridge } from '@/lib/dvrx-bridge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get('case_id');
  const evidenceId = searchParams.get('evidence_id');

  try {
    if (searchParams.get('action') === 'vendors') {
      const data = await runDvrxBridge('list_supported_vendors');
      return NextResponse.json(data);
    } else if (caseId && evidenceId) {
      const vendor = searchParams.get('vendor');
      const data = await runDvrxBridge('inspect_evidence', {
        case_id: caseId,
        evidence_id: evidenceId,
        selected_vendor: vendor || undefined,
      });
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
        case_type: body.case_type || 'surveillance',
        name: body.name || body.case_id,
        agency: body.agency || undefined,
        jurisdiction: body.jurisdiction || undefined,
        technique: body.technique || undefined,
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
        selected_vendor: body.selected_vendor,
      });
      return NextResponse.json(data);
    } else if (action === 'generate_sample_evidence') {
      const fs = await import('fs/promises');
      const path = await import('path');
      const crypto = await import('crypto');
      const { getWritableEvidenceDirectory } = await import('@/lib/storage');
      const evidenceDir = getWritableEvidenceDirectory();
      const filename = `cctv_ch1_${Date.now()}.dd`;
      const filePath = path.join(evidenceDir, filename);
      const headerBlock = Buffer.from(
        'DVRX_FORENSIC_STREAM_CONTAINER_V1\n' +
        'JURISDICTION: Standard Laboratory Simulation\n' +
        'CAMERA_NODE: SYNTHETIC-LAB-CH1\n' +
        'FORMAT: H264_ANNEX_B_RAW\n' +
        '---BEGIN_RAW_STREAM_BLOCK---\n'
      );
      const nalUnits = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1e]), // SPS (Seq Param Set)
        Buffer.from([0x00, 0x00, 0x00, 0x01, 0x68, 0xce, 0x3c, 0x80]), // PPS (Pic Param Set)
        Buffer.from([0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x84, 0x00]), // IDR Keyframe
        Buffer.from([0x00, 0x00, 0x01, 0x61, 0x9a, 0x01, 0x02]),       // Non-IDR Slice
      ]);
      const block = Buffer.concat([headerBlock, nalUnits]);
      const fullBuffer = Buffer.alloc(256 * 1024);
      block.copy(fullBuffer, 0);
      for (let offset = block.length; offset < fullBuffer.length; offset += nalUnits.length) {
        nalUnits.copy(fullBuffer, offset, 0, Math.min(nalUnits.length, fullBuffer.length - offset));
      }
      const md5Digest = crypto.createHash('md5').update(fullBuffer).digest('hex');
      const sha256Digest = crypto.createHash('sha256').update(fullBuffer).digest('hex');

      try {
        await fs.writeFile(filePath, fullBuffer);
      } catch (writeError) {
        console.warn('[DVRX Storage] Sample bitstream disk write notice:', writeError);
      }

      const data = await runDvrxBridge('acquire_evidence', {
        case_id: body.case_id,
        source_path: filePath,
        examiner: body.examiner,
        notes: body.notes || `Generated synthetic surveillance sample (${filename})`,
        file_size: fullBuffer.length,
        md5: md5Digest,
        sha256: sha256Digest,
      });
      return NextResponse.json(data);
    } else if (action === 'analyze_vendor') {
      const data = await runDvrxBridge('analyze_vendor', {
        case_id: body.case_id,
        evidence_id: body.evidence_id,
        selected_vendor: body.selected_vendor,
      });
      return NextResponse.json(data);
    } else if (action === 'list_supported_vendors') {
      const data = await runDvrxBridge('list_supported_vendors');
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ status: 'error', message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
