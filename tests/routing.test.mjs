import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleForPath,isAppPath,canAccessPath,safeReturnTo} from '../lib/routing.mjs';
const id = '01234567-89ab-cdef-0123-456789abcdef';
test('recognizes list, form, stock, detail and edit routes without prefix collisions',()=>{
 for(const path of ['/projects','/projects/new',`/projects/${id}`,`/projects/${id}/edit`,`/labour/${id}/edit`,'/materials/stock','/materials/transactions/new']) assert.equal(isAppPath(path),true,path);
 for(const path of ['/projectstuff','/projects/no-such-id','/orders/new/extra','/today/new','/login/anything']) assert.equal(isAppPath(path),false,path);
 assert.equal(moduleForPath(`/projects/${id}`),'projects');
 assert.equal(moduleForPath('/projectstuff'),null);
});
test('direct navigation enforces finance, vendor and report creation permissions',()=>{
 for(const role of ['engineer','sales']) for(const path of ['/subcon','/vendorledger/new']) assert.equal(canAccessPath(path,role),false);
 for(const role of ['md','qms','accounts','admin']) assert.equal(canAccessPath('/vendorledger',role),true);
 assert.equal(canAccessPath('/vendordb','qms'),false);
 assert.equal(canAccessPath('/vendordb/new','sales'),true);
 assert.equal(canAccessPath('/indents/new','sales'),false);
 assert.equal(canAccessPath('/dpr/new','accounts'),false);
 assert.equal(canAccessPath('/indents/new','engineer'),true);
 assert.equal(canAccessPath('/today','outsider'),false);
});
test('login keeps valid deep links and filters while rejecting unsafe destinations',()=>{
 assert.equal(safeReturnTo(`/indents/${id}?tab=quotes`),`/indents/${id}?tab=quotes`);
 assert.equal(safeReturnTo('/materials/stock?project=one#transactions'),'/materials/stock?project=one#transactions');
 for(const value of ['https://evil.test','//evil.test','/\\evil.test','/login','/login/anything','/missing','/projects/%2e%2e/login','/today\n',null]) assert.equal(safeReturnTo(value),'/today',String(value));
 assert.equal(safeReturnTo('/vendorledger','engineer'),'/today');
 assert.equal(safeReturnTo('/vendorledger','md'),'/vendorledger');
});
test('all administrator URLs require admin and survive sign-in safely',()=>{
 for(const path of ['/admin','/admin/users','/admin/users/new',`/admin/users/${id}/edit`,'/admin/records','/admin/records/projects','/admin/records/projects/new',`/admin/records/projects/${id}/edit`,'/admin/activity']){
  assert.equal(isAppPath(path),true,path);assert.equal(canAccessPath(path,'admin'),true,path);assert.equal(safeReturnTo(path,'admin'),path);
  for(const role of ['md','engineer','sales','qms','accounts'])assert.equal(canAccessPath(path,role),false,role+' '+path);
 }
 for(const path of ['/admin/users/no-such-user/edit','/admin/records/profiles','/admin/anything','/admin/records/__proto__'])assert.equal(isAppPath(path),false,path);
});
