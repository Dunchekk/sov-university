import {z} from 'zod';
import type {Prisma} from '@/generated/prisma/client';
import {db} from '@/server/db';
import type {StudentContext} from '@/server/access';
import {invariant,notFound} from '@/server/errors';
import {idempotent} from '@/server/idempotency';
import {fieldsSchema} from './forms';
import {workingDayDeadline} from '@/shared/lib/time';
import {notify} from '@/modules/notifications';
import {unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {storageRoot} from '@/modules/files/service';
export const createSchema=z.object({serviceSlug:z.string().max(80),fields:z.record(z.string(),z.unknown()),key:z.string().min(8).max(128)}).strict();
export const updateSchema=z.object({fields:z.record(z.string(),z.unknown()),version:z.number().int().min(0)}).strict();
export const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('submit'),version:z.number().int().min(0),key:z.string().min(8).max(128)}).strict(),
 z.object({action:z.enum(['cancel','clone','delete']),version:z.number().int().min(0),key:z.string().min(8).max(128)}).strict(),
 z.object({action:z.enum(['respond','comment']),text:z.string().trim().min(3).max(2000),version:z.number().int().min(0),key:z.string().min(8).max(128)}).strict()
]);
export async function requestDetail(student:StudentContext,id:string){const item=await db.studentRequest.findFirst({where:{id,studentId:student.id},include:{service:true,history:{orderBy:{createdAt:'asc'},take:100},comments:{orderBy:{createdAt:'asc'},take:100},files:{select:{id:true,originalName:true,size:true,purpose:true}},achievements:{include:{achievement:{select:{id:true,title:true}}}}}});if(!item)throw notFound();return item;}
export async function createRequest(student:StudentContext,input:z.infer<typeof createSchema>){const service=await db.service.findFirst({where:{slug:input.serviceSlug,active:true}});if(!service)throw notFound();const fields=fieldsSchema(service.slug,true).parse(input.fields) as Prisma.InputJsonObject;return idempotent(student.id,'request:create',input.key,{serviceSlug:service.slug,fields},async tx=>{const item=await tx.studentRequest.create({data:{studentId:student.id,serviceSlug:service.slug,fields,history:{create:{status:'DRAFT',text:'Черновик сохранён.'}}}});return {id:item.id,version:item.version};});}
export async function updateRequest(student:StudentContext,id:string,input:z.infer<typeof updateSchema>){const item=await requestDetail(student,id);const fields=fieldsSchema(item.serviceSlug,true).parse(input.fields) as Prisma.InputJsonObject;const result=await db.studentRequest.updateMany({where:{id,studentId:student.id,status:'DRAFT',version:input.version},data:{fields,version:{increment:1}}});invariant(result.count===1,409,'CONFLICT','Черновик изменился. Обновите страницу перед сохранением.');return {id,version:input.version+1};}
async function validateEligibility(tx:Prisma.TransactionClient,student:StudentContext,slug:string,fields:Record<string,unknown>){if(slug==='tuition-payment'){const contract=await tx.contract.findFirst({where:{id:String(fields.contractId),studentId:student.id}});if(!contract)throw notFound();}if(slug==='order'){if(!await tx.studentOrder.findFirst({where:{id:String(fields.orderId),studentId:student.id}}))throw notFound();}if(slug==='scholarship'){const now=new Date();invariant(await tx.campaign.findFirst({where:{id:String(fields.campaignId),startsAt:{lte:now},endsAt:{gte:now}}}),422,'CAMPAIGN_CLOSED','Приём заявок в эту кампанию закрыт.');const ids=fields.achievementIds as string[];const count=await tx.achievement.count({where:{id:{in:ids},studentId:student.id,status:'CONFIRMED'}});invariant(count===ids.length,422,'ACHIEVEMENTS','Выберите только свои подтверждённые достижения.');}}
export async function requestAction(student:StudentContext,id:string,input:z.infer<typeof actionSchema>){return idempotent(student.id,`request:${id}:${input.action}`,input.key,input,async tx=>{
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${student.id}`},0))`;
 const item=await tx.studentRequest.findFirst({where:{id,studentId:student.id},include:{service:true,files:true}});if(!item)throw notFound();
 invariant(item.version===input.version,409,'CONFLICT','Обращение изменилось. Обновите страницу.');
 if(input.action==='clone'){const fields=fieldsSchema(item.serviceSlug,true).parse(item.fields) as Prisma.InputJsonObject;const clone=await tx.studentRequest.create({data:{studentId:student.id,serviceSlug:item.serviceSlug,fields,history:{create:{status:'DRAFT',text:'Новый черновик на основе прошлого обращения.'}}}});return {id:clone.id,version:0};}
 if(input.action==='delete'){invariant(item.status==='DRAFT',409,'STATUS','Удалить можно только черновик.');invariant(item.files.length===0,409,'FILES','Сначала удалите вложения черновика.');await tx.studentRequest.delete({where:{id}});return {id,deleted:true};}
 let status=item.status;let text='';let fields=item.fields as Prisma.InputJsonObject;
 if(input.action==='submit'){invariant(item.status==='DRAFT',409,'STATUS','Это обращение уже отправлено.');invariant(item.service.active,422,'SERVICE_CLOSED','Услуга временно недоступна.');fields=fieldsSchema(item.serviceSlug).parse(item.fields) as Prisma.InputJsonObject;await validateEligibility(tx,student,item.serviceSlug,fields);invariant(item.serviceSlug!=='support'||item.files.length<=1,422,'FILES','В поддержку можно приложить один PDF.');status='SUBMITTED';text='Обращение принято. Ожидайте рассмотрения.';if(item.serviceSlug==='scholarship')await tx.requestAchievement.createMany({data:(fields.achievementIds as string[]).map(achievementId=>({requestId:id,achievementId}))});}
 else if(input.action==='cancel'){const snapshot=item.serviceSnapshot as Record<string,unknown>|null;invariant(item.status==='SUBMITTED'&&(snapshot?.cancellable??item.service.cancellable),409,'STATUS','Отозвать это обращение сейчас нельзя.');status='CANCELLED';text='Обращение отозвано студентом.';}
 else if(input.action==='respond'){invariant(item.status==='NEEDS_INFO',409,'STATUS','Уточнение сейчас не запрашивается.');status='IN_REVIEW';text='Студент предоставил уточнение. Обращение возвращено на рассмотрение.';}
 else {invariant(['SUBMITTED','IN_REVIEW','READY'].includes(item.status),409,'STATUS','Комментарий недоступен в этом состоянии.');text='Добавлен комментарий студента.';}
 const result=await tx.studentRequest.updateMany({where:{id,studentId:student.id,version:input.version},data:{status,version:{increment:1},...(input.action==='submit'?{fields,submittedAt:new Date(),dueAt:workingDayDeadline(new Date(),item.service.workDays),serviceSnapshot:{title:item.service.title,version:item.service.version,department:item.service.department,workDays:item.service.workDays,cancellable:item.service.cancellable,studentName:student.name,program:student.group.program.name,group:student.group.name}}:{})}});invariant(result.count===1,409,'CONFLICT','Обращение изменилось. Обновите страницу.');
 await tx.requestHistory.create({data:{requestId:id,status,text}});if('text'in input)await tx.requestComment.create({data:{requestId:id,authorName:student.name,authorRole:'STUDENT',text:input.text}});
 await notify(tx,student.id,'REQUEST',input.action==='submit'?'Обращение принято':'Обращение обновлено',text,`/requests/${id}`,`request:${id}:${input.version+1}`);
 return {id,version:input.version+1,status};
});}
export async function deleteDraftFile(student:StudentContext,fileId:string){const key=await db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${student.id}`},0))`;const file=await tx.fileObject.findFirst({where:{id:fileId,studentId:student.id,purpose:'REQUEST_ATTACHMENT',request:{status:{in:['DRAFT','NEEDS_INFO']}}}});if(!file)throw notFound();await tx.fileObject.delete({where:{id:fileId}});return file.storageKey;});await unlink(join(storageRoot(),key)).catch(()=>{});return {ok:true};}
