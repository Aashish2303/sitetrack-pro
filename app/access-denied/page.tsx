"use client";
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
export default function AccessDenied() {
  return <main className="loading-screen"><div className="card" style={{padding:32,maxWidth:480}}><span className="core-section-label">WORKSPACE ACCESS</span><h1 style={{margin:'16px 0'}}>Access restricted</h1><p style={{marginBottom:24}}>Your account does not have access to this section. Contact your administrator if you need permission.</p><div className="action-bar"><Link href="/today" className="btn btn-acc">Open overview</Link><button className="btn btn-ghost" onClick={async()=>{await createClient().auth.signOut();window.location.assign('/login')}}>Sign out</button></div></div></main>;
}
