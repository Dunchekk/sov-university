import {z} from 'zod';
import {route,jsonBody} from '@/server/http';
import {db} from '@/server/db';
import {invariant,notFound} from '@/server/errors';
const schema=z.object({kind:z.enum(['group','lecturer','room']),targetId:z.string().max(100)}).strict();
export const GET=route(async(_request,student)=>db.savedSchedule.findMany({where:{studentId:student.id},select:{id:true,kind:true,targetId:true,label:true}}));
export const POST=route(async(request,student)=>{const data=await jsonBody(request,schema);const target=data.kind==='group'?await db.group.findUnique({where:{id:data.targetId}}):data.kind==='lecturer'?await db.person.findUnique({where:{id:data.targetId}}):await db.room.findUnique({where:{id:data.targetId}});if(!target)throw notFound();invariant(await db.savedSchedule.count({where:{studentId:student.id}})<20,422,'LIMIT','Можно сохранить до 20 расписаний.');return db.savedSchedule.upsert({where:{studentId_kind_targetId:{studentId:student.id,...data}},create:{studentId:student.id,...data,label:target.name},update:{}});});
export const DELETE=route(async(request,student)=>{const data=await jsonBody(request,schema);await db.savedSchedule.deleteMany({where:{studentId:student.id,...data}});return {ok:true};});
