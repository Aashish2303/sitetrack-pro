import {AdminUserForm} from '@/components/admin/AdminUsers';
export default function Page({params}:{params:{id:string}}){return <AdminUserForm id={params.id}/>}
