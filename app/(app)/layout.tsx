import Shell from "@/components/Shell";
import { getWorkspaceProfile } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const profile=await getWorkspaceProfile();
  if (!profile) redirect('/access-denied');
  return <Shell initialProfile={profile}>{children}</Shell>;
}
