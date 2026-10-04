import { Metadata } from 'next';
import MercuryLogin from '@/components/ui/mercury-login';

export const metadata: Metadata = {
  title: 'DVRX — Examiner Forensic Terminal Access',
  description: 'Cryptographic authentication gateway for DVRX surveillance and cyber forensic investigations.',
};

export default function LoginPage() {
  return (
    <MercuryLogin
      systemNode="DVRX SECURE NODE: 0x992"
      titlePrimary="DVRX"
      titleSecondary="FORENSIC ACCESS"
    />
  );
}
