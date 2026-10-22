"use client";
import Link from 'next/link';
export default function PageError({reset}:{reset:()=>void}) {
 return <div className="card" role="alert" style={{padding:28}}><h1>Unable to open this section</h1><p style={{margin:'14px 0'}}>Please try again. Your saved records are still available.</p><div className="action-bar"><button className="btn btn-acc" onClick={reset}>Try again</button><Link className="btn btn-ghost" href="/today">Back to overview</Link></div></div>;
}
