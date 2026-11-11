export class ApiError extends Error { constructor(message:string,public fields:Record<string,string[]>={},public status=400){super(message);} }
export async function api<T=Record<string,unknown>>(url:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(url,{...options,headers:{...(options.body instanceof FormData?{}:options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const data=await response.json(); if(!response.ok)throw new ApiError(data.error?.message??'Не удалось выполнить действие.',data.error?.fields??{},response.status); return data as T;
}
export const operationKey=()=>crypto.randomUUID();
