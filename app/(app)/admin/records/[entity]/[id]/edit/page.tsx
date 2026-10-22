import {AdminRecordForm} from '@/components/admin/AdminRecords';
import {entityFor} from '@/lib/admin/entities.mjs';
import {notFound} from 'next/navigation';
export default function Page({params}:{params:{entity:string;id:string}}){if(!entityFor(params.entity))notFound();return <AdminRecordForm entity={params.entity} id={params.id}/>}
