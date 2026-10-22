export type AdminField = {key:string;label:string;type:string;required?:boolean;options?:string[];entity?:string};
export type AdminEntity = {label:string;icon:string;fields:AdminField[];note?:string;workflow?:string;readOnly?:boolean};
export const ADMIN_ENTITIES:Record<string,AdminEntity>;
export function entityFor(key:string):AdminEntity|null;
