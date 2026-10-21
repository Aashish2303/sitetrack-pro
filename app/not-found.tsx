import Link from 'next/link';
export default function NotFound() {
 return <main className="loading-screen"><div><span className="core-section-label">404 · PAGE NOT FOUND</span><h1 style={{margin:'18px 0'}}>This page isn’t available.</h1><p style={{marginBottom:24}}>Check the address or return to your workspace.</p><Link className="btn btn-acc" href="/today">Back to overview</Link></div></main>;
}
