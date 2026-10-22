"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {IconArrowUpRight,IconArrowRight,IconLock,IconEye,IconEyeOff,IconCheck,IconBuildingSkyscraper,IconPackage,IconUsers,IconShieldCheck} from '@tabler/icons-react';
import {createClient} from '@/lib/supabase/client';
import {safeReturnTo} from '@/lib/routing.mjs';
import CoreArtwork from '@/components/CoreArtwork';
export default function Login(){
 const router=useRouter();
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{const sb=createClient();const {error}=await sb.auth.signInWithPassword({email:username.includes('@')?username.trim().toLowerCase():`${username.trim().toLowerCase()}@sitetrack.local`,password});
   if(error){setError('The username or password is incorrect. Please try again.');return}
   const target = safeReturnTo(new URLSearchParams(window.location.search).get('next'));
   router.replace(target);router.refresh();
  }catch{setError('Unable to connect. Check your connection and try again.')}finally{setBusy(false)}
 }
 return <div className="core-login">
  <header className="core-login-header">
   <a className="core-wordmark" href="/login" aria-label="SiteTrack Pro home">sitetrack<span>.</span><small>PRO</small></a>
   <div className="core-header-links"><span>Aashish Infra Projects</span><a href="#sign-in" className="btn btn-acc">Open workspace <IconArrowUpRight size={15}/></a></div>
  </header>
  <main className="core-login-main">
   <section className="core-introduction">
    <div className="core-pill"><IconCheck size={14}/><span>One workspace. <b>Every site connected.</b></span></div>
    <h1>Your <span>construction</span><br/>starts here.</h1>
    <p>Your people, materials, and progress.<br/>A clear picture of every project, from the first indent to the final handover.</p>
    <a className="core-text-link" href="#sign-in">Step into your workspace <IconArrowRight size={18}/></a>
    <CoreArtwork/>
   </section>
   <section className="core-access" id="sign-in" aria-labelledby="login-heading">
    <div className="core-access-top"><span className="core-section-label">TEAM ACCESS</span><IconArrowUpRight size={20}/></div>
    <div className="core-access-title"><span className="core-access-icon"><IconBuildingSkyscraper size={25} stroke={1.4}/></span><h2 id="login-heading">Welcome back<span>.</span></h2><p>Sign in to your construction workspace.</p></div>
    <form onSubmit={login}>
     <div className="core-field"><label htmlFor="username">Username or email</label><input id="username" className="input" placeholder="Enter your username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></div>
     <div className="core-field"><label htmlFor="password">Password</label><div className="login-password"><input id="password" className="input" style={{paddingRight:45}} type={show?'text':'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}>{show?<IconEyeOff size={18}/>:<IconEye size={18}/>}</button></div></div>
     {error&&<p className="core-login-error" role="alert">{error}</p>}
     <button className="btn btn-acc core-signin" disabled={busy} type="submit">{busy?'Signing in…':'Sign in to workspace'}<IconArrowRight size={18}/></button>
    </form>
    <div className="core-access-note"><IconLock size={15}/><p>Secure access for your team.<br/><span>Need an account? Contact your administrator.</span></p></div>
   </section>
  </main>
  <section className="core-login-capabilities" aria-label="Workspace capabilities">
   <div><IconBuildingSkyscraper size={22} stroke={1.4}/><span><strong>Project clarity</strong><small>Daily work, progress & BOQ</small></span></div>
   <div><IconPackage size={22} stroke={1.4}/><span><strong>Connected procurement</strong><small>Indents, approvals & deliveries</small></span></div>
   <div><IconUsers size={22} stroke={1.4}/><span><strong>Your team, together</strong><small>Labour, quality & finance</small></span></div>
  </section>
  <footer className="core-login-footer"><span>SiteTrack Pro · Aashish Infra Projects</span><span>Hyderabad, India</span></footer>
 </div>;
}
