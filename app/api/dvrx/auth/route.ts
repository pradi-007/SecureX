import { NextRequest, NextResponse } from 'next/server';
import { authenticateExaminer, registerExaminer, listExaminers } from '@/lib/auth';

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

    if (action === 'register') {
      const { user_id, password, name, agency } = body;
      if (!user_id || !password) {
        return NextResponse.json(
          { status: 'error', message: 'User ID and sequence key password are required.' },
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
        message: 'Examiner registered successfully.',
        examiner: res.examiner,
      });
    }

    if (action === 'login') {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return NextResponse.json(
          { status: 'error', message: 'User ID and sequence key password are required.' },
          { status: 400 }
        );
      }

      const res = authenticateExaminer({
        user_id,
        password,
      });

      if (!res.success) {
        return NextResponse.json({ status: 'error', message: res.message }, { status: 401 });
      }

      return NextResponse.json({
        status: 'ok',
        message: 'Authenticated successfully.',
        examiner: res.examiner,
      });
    }

    return NextResponse.json({ status: 'error', message: `Unknown action "${action}"` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
