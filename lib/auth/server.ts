import {cache} from 'react';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/types';
export const getWorkspaceProfile=cache(async():Promise<Profile|null>=>{
 const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(!user)return null;
 const {data}=await sb.from('profiles').select('id,username,name,role,avatar,is_active').eq('id',user.id).single();
 return data?.is_active ? data as Profile : null;
});
