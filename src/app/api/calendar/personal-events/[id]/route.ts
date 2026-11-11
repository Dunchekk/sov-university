import {route,jsonBody} from '@/server/http';
import {personalSchema,savePersonal,deletePersonal} from '@/modules/calendar/personal';
export const PATCH=route(async(request,student)=>savePersonal(student,await jsonBody(request,personalSchema),new URL(request.url).pathname.split('/').at(-1)!));
export const DELETE=route(async(request,student)=>deletePersonal(student,new URL(request.url).pathname.split('/').at(-1)!));
