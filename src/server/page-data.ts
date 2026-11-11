import {notFound} from 'next/navigation';
import {AppError} from './errors';
export async function pageData<T>(promise:Promise<T>):Promise<T>{try{return await promise;}catch(e){if(e instanceof AppError&&e.status===404)notFound();throw e;}}
