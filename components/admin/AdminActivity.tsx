"use client";
import {useEffect,useState} from 'react';
import {adminCall} from '@/lib/admin/client';
export default function AdminActivity(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;adminCall('activity').then(d=>{if(live)setRows(d)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
 return <><div className="admin-section-heading"><h2>Administrator activity</h2><span className="muted" style={{fontSize:12}}>Latest 100 actions</span></div>{error&&<div className="admin-error" role="alert">{error}</div>}<div className="card table-wrap"><table className="dt"><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{new Date(row.at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</td><td>{row.actor||'Administrator'}</td><td>{row.action.replaceAll('_',' ')}</td><td>{row.target_id?.slice(0,30)||'—'}</td><td><span className="admin-json">{row.details?.entity||row.details?.new_role||'—'}{row.details?.fields?' · '+row.details.fields.join(', '):''}</span></td></tr>)}</tbody></table>{loading&&<div className="admin-empty" role="status">Loading activity…</div>}{!loading&&!rows.length&&<div className="admin-empty">Administrator actions will appear here.</div>}</div></>;
}
