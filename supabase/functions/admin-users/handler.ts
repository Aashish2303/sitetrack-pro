const roles=['md','engineer','sales','qms','accounts','admin'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function allowedOrigin(origin:string){try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='sitetrack-review.vercel.app'||u.hostname==='sitetrack-pro-nine.vercel.app'||u.hostname==='sitetrack.pro'||u.hostname==='app.sitetrack.pro'||(u.hostname.startsWith('sitetrack-')&&u.hostname.endsWith('-stuffspam24-3226.vercel.app')))}catch{return false}}
export function createAdminHandler(createClient:any,env:(name:string)=>string|undefined) { return async(req:Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(allowedOrigin(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!allowedOrigin(origin))return reply({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const userClient=createClient(env('SUPABASE_URL')!,env('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser(auth.slice(7));
 if(authError||!user)return reply({error:'Sign in required'},401);
 const {data:profile}=await userClient.from('profiles').select('role,is_active').eq('id',user.id).single();
 if(profile?.role!=='admin'||!profile.is_active)return reply({error:'Administrator access required'},403);
 if(Number(req.headers.get('content-length')||0)>10000)return reply({error:'Request too large'},413);
 let body:Record<string,unknown>;try{const raw=await req.text();if(raw.length>10000)return reply({error:'Request too large'},413);body=JSON.parse(raw)}catch{return reply({error:'Invalid request'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request'},400);
 const action=body.action;
 if(action!=='create'&&action!=='password')return reply({error:'Unknown account action'},400);
 const password=typeof body.password==='string'?body.password:'';
 if(password.length<12||password.length>128||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password))return reply({error:'Use 12–128 characters with uppercase, lowercase and a number.'},400);
 const admin=createClient(env('SUPABASE_URL')!,env('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 async function event(event:string,target:string){const {error}=await userClient.rpc('admin_console',{p_action:'account_event',p_payload:{event,target}});if(error)throw error}
 try{
  if(action==='create'){
   const username=String(body.username||'').trim().toLowerCase(),name=String(body.name||'').trim(),role=String(body.role||'');
   if(!/^[a-z0-9_]{3,40}$/.test(username)||name.length<1||name.length>100||!roles.includes(role))return reply({error:'Enter a name, valid role and username (3–40 lowercase letters, numbers or underscores).'},400);
   await event('ACCOUNT_CREATE_REQUEST',username);
   const {data,error}=await admin.auth.admin.createUser({email:`${username}@sitetrack.local`,password,email_confirm:true,app_metadata:{role},user_metadata:{username,name}});
   if(error){await event('ACCOUNT_ACTION_FAILED',username);return reply({error:error.message},400)}
   await event('ACCOUNT_CREATED',data.user.id);
   return reply({id:data.user.id,username});
  }
  const id=String(body.id||'');if(!uuid.test(id))return reply({error:'Invalid account'},400);
  const {data:target}=await userClient.from('profiles').select('id').eq('id',id).single();
  if(!target)return reply({error:'Account not found'},404);
  await event('PASSWORD_RESET_REQUEST',id);
  const {error}=await admin.auth.admin.updateUserById(id,{password});
  if(error){await event('ACCOUNT_ACTION_FAILED',id);return reply({error:error.message},400)}
  await event('PASSWORD_RESET',id);
  return reply({ok:true});
 }catch{return reply({error:'Account action could not be completed. Check activity and retry.'},400)}
};}
