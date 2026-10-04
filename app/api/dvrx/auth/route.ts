import { NextRequest, NextResponse } from 'next/server';
import { authenticateExaminer, registerExaminer, listExaminers, syncExaminers } from '@/lib/auth';

export async function GET() {
  try {
    const examiners = listExaminers();
    return NextResponse.json({ status: 'ok', examiners });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'login';
    const client_vault = body.client_vault;

    // Proactively sync client vault if supplied in any request
    if (client_vault && Array.isArray(client_vault)) {
      syncExaminers(client_vault);
    }

    if (action === 'sync') {
      return NextResponse.json({ status: 'ok', message: 'Vault synced successfully' });
    }

    if (action === 'register') {
      const { user_id, password, name, agency } = body;
      if (!user_id || !password) {
        return NextResponse.json(
          { status: 'error', message: 'User ID and password are required.' },
          { status: 400 }
        );
      }

      const res = registerExaminer({
        user_id,
        password,
        name,
        agency,
      });

      if (!res.success) {
        return NextResponse.json({ status: 'error', message: res.message }, { status: 400 });
      }

      return NextResponse.json({
        status: 'ok',
        message: res.message || 'Examiner registered successfully.',
        examiner: res.examiner,
        record: res.record,
      });
    }

    if (action === 'login') {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return NextResponse.json(
          { status: 'error', message: 'User ID and password are required.' },
          { status: 400 }
        );
      }

      const res = authenticateExaminer({
        user_id,
        password,
        client_vault,
      });

      if (!res.success) {
        return NextResponse.json({ status: 'error', message: res.message }, { status: 401 });
      }

      return NextResponse.json({
        status: 'ok',
        message: 'Authenticated successfully.',
        examiner: res.examiner,
        record: res.record,
      });
    }

    return NextResponse.json({ status: 'error', message: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
