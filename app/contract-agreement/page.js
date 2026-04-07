'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ContractAgreementPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/start');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
