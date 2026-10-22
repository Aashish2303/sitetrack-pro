import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getWorkspaceProfile} from '@/lib/auth/server';
import './admin.css';
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const profile=await getWorkspaceProfile();if(profile?.role!=='admin')redirect('/access-denied');
 return <section className="admin-area"><header className="admin-heading"><div><span className="core-section-label">ADMINISTRATION</span><h1>Workspace controls<span>.</span></h1><p>Manage your team, records and access from one place.</p></div><span className="admin-secure"><i className="ti ti-shield-lock"/>Administrator access</span></header><nav className="admin-tabs" aria-label="Administration"><Link href="/admin">Overview</Link><Link href="/admin/users">Users & roles</Link><Link href="/admin/records">Manage records</Link><Link href="/admin/activity">Activity history</Link></nav>{children}</section>;
}
