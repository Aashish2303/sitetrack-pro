import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
for(const file of ['tests/fixtures/baseline.sql','supabase/migrations/20261021_access_and_integrity.sql','supabase/complete-workflows.sql','supabase/migrations/20261022000105_admin_console_controls.sql'])await db.exec(await fs.readFile(file,'utf8'));
const roles=['admin','md','engineer','sales','qms','accounts'],ids={};let checks=0;
const ok=name=>{checks++;console.log('PASS',name)};
for(const [i,role]of roles.entries()){ids[role]=`10000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`;await db.query('insert into profiles(id,username,name,role)values($1,$2,$2,$2)',[ids[role],role])}
const second='10000000-0000-0000-0000-000000000099';await db.query("insert into profiles(id,username,name,role)values($1,'second_admin','Second admin','admin')",[second]);
async function as(role){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]||role]);await db.exec('set role authenticated')}
async function call(action,payload={}){return(await db.query('select admin_console($1,$2) data',[action,payload])).rows[0].data}
async function denied(fn,label){try{await fn();throw Error('Unexpectedly allowed: '+label)}catch(e){if(e.message.startsWith('Unexpectedly'))throw e;ok(label)}}
for(const role of roles.filter(r=>r!=='admin')){await as(role);for(const action of ['overview','users','records','save_user','save_record','delete_record','activity','account_event'])await denied(()=>call(action,{}),`${role} denied ${action}`)}
await as('admin');assert.equal((await call('overview')).users,7);ok('Admin can see overview');assert.equal((await call('users')).length,7);ok('Admin lists users');
await denied(()=>call('save_user',{id:ids.admin,name:'Admin',role:'engineer',is_active:true}),'Admin cannot demote self');
await denied(()=>call('save_user',{id:ids.admin,name:'Admin',role:'admin',is_active:false}),'Admin cannot deactivate self');
await call('save_user',{id:ids.engineer,name:'Updated engineer',role:'sales',is_active:true});await as('engineer');assert.equal((await db.query('select my_role()r')).rows[0].r,'sales');ok('Role changes take effect immediately');
await denied(()=>db.query('update profiles set is_active=true where id=$1',[ids.engineer]),'Non-admin cannot set account status');
await as('admin');await call('save_user',{id:ids.engineer,name:'Updated engineer',role:'engineer',is_active:false});await as('engineer');assert.equal((await db.query('select my_role()r')).rows[0].r,null);ok('Deactivated user loses membership');assert.equal((await db.query('select * from projects_view')).rows.length,0);ok('Deactivated user cannot read projects');await denied(()=>call('overview'),'Deactivated user denied console');
await as('admin');await call('save_user',{id:ids.engineer,name:'Engineer',role:'engineer',is_active:true});
const p=await call('save_record',{entity:'projects',data:{name:'Admin-created project',value:1000,status:'Active'}});assert.equal(p.name,'Admin-created project');ok('Admin creates project');
const updated=await call('save_record',{entity:'projects',id:p.id,data:{name:'Corrected project',value:2000}});assert.equal(Number(updated.value),2000);ok('Admin edits financial and text fields');
const list=await call('records',{entity:'projects'});assert.equal(list.total,1);assert.equal(list.rows[0].name,'Corrected project');ok('Record pagination returns saved data');
await denied(()=>call('save_record',{entity:'profiles',data:{role:'admin'}}),'Profile edits cannot bypass user controls');
await denied(()=>call('records',{entity:'projects;delete from profiles'}),'Entity injection blocked');
await denied(()=>call('save_record',{entity:'projects',id:p.id,data:{id:second,name:'Bad'}}),'Immutable ID injection blocked');
await denied(()=>call('save_user',{id:ids.engineer,name:'Bad',role:'superadmin',is_active:true}),'Unknown role rejected');
await denied(()=>call('save_record',{entity:'indent_quotations',data:{total:1}}),'Quotation edits require workflow');
const boq=await call('save_record',{entity:'boq_items',data:{project_id:p.id,item:'RCC',unit:'Cum',boq_qty:100,rate:500,cum_done:0}});
const dpr=await call('save_record',{entity:'dpr_entries',data:{project_id:p.id,boq_item_id:boq.id,qty_done:10,work_status:'Completed'}});assert.equal(Number((await db.query('select cum_done from boq_items_view where id=$1',[boq.id])).rows[0].cum_done),10);ok('Admin-created DPR updates BOQ');
await denied(()=>call('save_record',{entity:'dpr_entries',id:dpr.id,data:{qty_done:20}}),'Linked progress quantity changes cannot desynchronize BOQ');
const order=await call('save_record',{entity:'material_orders',data:{project_id:p.id,vendor:'QA',material:'Cement',ordered_qty:100,unit:'Bag',rate:500}});await call('save_record',{entity:'material_order_deliveries',data:{order_id:order.id,delivered_qty:50}});
await denied(()=>call('save_record',{entity:'material_orders',id:order.id,data:{ordered_qty:20}}),'Cannot reduce order below received quantity');
const vendor=await call('save_record',{entity:'vendors',data:{vendor_name:'Disposable QA vendor'}});await call('delete_record',{entity:'vendors',id:vendor.id});assert.equal((await call('records',{entity:'vendors'})).total,0);ok('Admin deletes a selected independent record');
await denied(()=>call('delete_record',{entity:'dpr_entries',id:dpr.id}),'DPR deletion requires workflow reconciliation');
assert((await call('activity')).some(e=>e.action==='USER_UPDATED'));ok('Role changes are audited');assert((await call('activity')).some(e=>e.action==='RECORD_UPDATED'));ok('Record changes are audited');
for(let i=0;i<20;i++)await call('account_event',{event:'PASSWORD_RESET_REQUEST',target:ids.engineer});await denied(()=>call('account_event',{event:'PASSWORD_RESET_REQUEST',target:ids.engineer}),'Credential action rate limit');
await db.exec('reset role;set role anon');await denied(()=>call('overview'),'Anonymous console denied');
console.log(`${checks} admin integration checks passed.`);await db.close();
