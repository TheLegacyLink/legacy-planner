import { redirect } from 'next/navigation';

export default function LinkLeadsRegistrationRedirect({ searchParams }) {
  const next = typeof searchParams?.next === 'string' ? searchParams.next : '/lead-marketplace';
  redirect(`/start/licensed?next=${encodeURIComponent(next)}`);
}
