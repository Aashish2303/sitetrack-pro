import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile('supabase/functions/admin-users/handler.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {createAdminHandler}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const id='10000000-0000-0000-0000-000000000001';
const strong='Example-Password-52';
function setup({role='admin',active=true,valid=true}={}){
 const calls=[];
 const make=(url,key)=>({auth:key==='service'?{admin:{createUser:async p=>{calls.push(['create',p]);return{data:{user:{id}},error:null}},updateUserById:async(id,p)=>{calls.push(['password',p]);return{error:null}}}}:{getUser:async()=>({data:{user:valid?{id}:null},error:valid?null:{message:'Invalid JWT'}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id,role,is_active:active}})})})}),rpc:async(name,args)=>{calls.push(['audit',args]);return{error:null}}});
 const handler=createAdminHandler(make,name=>name==='SUPABASE_SERVICE_ROLE_KEY'?'service':'public');
 const invoke=(body,options={})=>handler(new Request('https://example.test/admin-users',{method:'POST',headers:{origin:'https://sitetrack-review.vercel.app',authorization:'Bearer signed-user-token',...options.headers},body:JSON.stringify(body)}));
 return{calls,invoke,handler};
}
test('account endpoint requires a verified active administrator',async()=>{
 for(const options of [{valid:false},{role:'engineer'},{role:'md'},{role:'admin',active:false}]){const {invoke,calls}=setup(options);const res=await invoke({action:'create',username:'staff_1',name:'Staff',role:'admin',password:strong});assert.equal(res.status,options.valid===false?401:403);assert.equal(calls.length,0)}
});
test('anonymous and cross-origin requests cannot mutate accounts',async()=>{
 const {handler,calls}=setup();assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);
 assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://evil.test',authorization:'Bearer token'}}))).status,403);assert.equal(calls.length,0);
});
test('account fields and password strength are validated before mutation',async()=>{
 const {invoke,calls}=setup();for(const body of [null,[],{action:'unknown'},{action:'create',username:'staff',role:'engineer',name:'Staff',password:'weak'},{action:'create',username:'bad name',role:'engineer',name:'Staff',password:strong},{action:'create',username:'staff',role:'owner',name:'Staff',password:strong}])assert.equal((await invoke(body)).status,400);
 assert.equal(calls.filter(c=>['create','password'].includes(c[0])).length,0);
});
test('account creation uses supported Auth Admin API and server-owned role metadata',async()=>{
 const {invoke,calls}=setup();const res=await invoke({action:'create',username:'STAFF_1',name:'Site Staff',role:'engineer',password:strong});assert.equal(res.status,200);
 const p=calls.find(c=>c[0]==='create')[1];assert.equal(p.email,'staff_1@sitetrack.local');assert.equal(p.app_metadata.role,'engineer');assert.equal(p.user_metadata.role,undefined);assert.equal(p.email_confirm,true);
 assert(calls.some(c=>c[0]==='audit'&&c[1].p_payload.event==='ACCOUNT_CREATED'));assert(!(await res.text()).includes(strong));
});
test('password reset audits the action without retaining a password',async()=>{
 const {invoke,calls}=setup();const res=await invoke({action:'password',id,password:strong});assert.equal(res.status,200);assert.equal(calls.find(c=>c[0]==='password')[1].password,strong);
 assert(calls.filter(c=>c[0]==='audit').every(c=>!JSON.stringify(c).includes(strong)));assert(!(await res.text()).includes(strong));
});
