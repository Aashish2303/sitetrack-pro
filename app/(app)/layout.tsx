import Shell from "@/components/Shell";
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const sb = createClient();
  const {data:{user}} = await sb.auth.getUser();
  if (!user) redirect('/login');
  const {data:profile} = await sb.from('profiles').select('id').eq('id',user.id).single();
  if (!profile) redirect('/access-denied');
  return <Shell>{children}</Shell>;
}
