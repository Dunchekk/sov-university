import {z} from 'zod';
import {cookies} from 'next/headers';
import {route,jsonBody} from '@/server/http';
import {db} from '@/server/db';
const schema=z.object({theme:z.enum(['light','dark','system']).optional(),calendarView:z.enum(['day','week','month']).optional(),sidebarCollapsed:z.boolean().optional(),notifications:z.object({SCHEDULE:z.boolean(),STUDY:z.boolean(),REQUEST:z.boolean(),COMMUNITY:z.boolean()}).strict().optional()}).strict();
export const PATCH=route(async(request,student)=>{const input=await jsonBody(request,schema);await db.preference.upsert({where:{studentId:student.id},create:{studentId:student.id,notifications:{SCHEDULE:true,STUDY:true,REQUEST:true,COMMUNITY:true},...input},update:input});if(input.theme)(await cookies()).set('theme',input.theme,{sameSite:'lax',path:'/',maxAge:31536000,secure:process.env.APP_URL?.startsWith('https://')});return {ok:true};});
