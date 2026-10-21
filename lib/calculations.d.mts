export function workingHours(start:string,end:string):number|null;
export function orderProgress(ordered:number,deliveries:number[]):{received:number;pending:number;percentage:number;complete:boolean};
export function stock(opening:number,transactions:{type:string;quantity:number}[]):number;
