import {createClient} from '@/lib/supabase/client';
export async function adminCall(action:string,payload:Record<string,unknown>={}) {
 const {data,error}=await createClient().rpc('admin_console',{p_action:action,p_payload:payload});
 if(error) throw new Error(error.message);
 return data;
}
export async function adminAccount(action:string,payload:Record<string,unknown>) {
 const {data,error}=await createClient().functions.invoke('admin-users',{body:{action,...payload}});
 if(error) {let message='Unable to update this account.';try{const body=await error.context?.json();message=body?.error||message}catch{}throw new Error(message)}
 if(data?.error)throw new Error(data.error);
 return data;
}
