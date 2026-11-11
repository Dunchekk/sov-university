import {z} from 'zod';
export type FormField={key:string;label:string;type:'text'|'textarea'|'select'|'date'|'number'|'checkbox'|'achievements';options?:{value:string;label:string}[];required?:boolean;hint?:string;when?:{key:string;value:string}};
const text=(key:string,label:string,type:FormField['type']='text',required=true):FormField=>({key,label,type,required});
const select=(key:string,label:string,values:string[],labels=values):FormField=>({key,label,type:'select',required:true,options:values.map((value,i)=>({value,label:labels[i]}))});
const recipient=text('recipient','Получатель');
const language=select('language','Язык документа',['ru','en'],['Русский','Английский']);
const format=select('format','Способ получения',['electronic','paper'],['Электронный PDF','Бумажный документ в учебном офисе']);
const copies:FormField={...text('copies','Количество экземпляров','number'),when:{key:'format',value:'paper'}};
const period=select('period','Учебный период',['current','all','1','2','3'],['Текущий семестр','Весь доступный период','1 семестр','2 семестр','3 семестр']);
export const formDefinitions:Record<string,FormField[]>={
 enrollment:[recipient,language,format,copies],grades:[period,language,recipient],transcript:[period,text('latinName','Имя и фамилия латиницей'),text('latinConfirmed','Написание имени проверено','checkbox'),recipient],
 'study-period':[period,text('purpose','Цель получения'),recipient],
 'study-leave':[text('employer','Работодатель'),text('activity','Учебное мероприятие'),text('startDate','Начало периода','date'),text('endDate','Конец периода','date')],
 'scholarship-payments':[period,recipient],
 'tuition-payment':[{key:'contractId',label:'Договор',type:'select',required:true},period,text('purpose','Назначение документа')],
 order:[{key:'orderId',label:'Учебный приказ',type:'select',required:true}],
 'document-copy':[select('documentType','Документ',['education','student-card'],['Документ об образовании (DEMO)','Студенческий билет (DEMO)']),format,copies],
 scholarship:[{key:'campaignId',label:'Кампания',type:'select',required:true},{key:'achievementIds',label:'Подтверждённые достижения',type:'achievements',required:true},text('description','Основание заявки','textarea')],
 'support-grant':[select('category','Категория',['education','emergency'],['Учебные расходы (демо)','Особая ситуация (демо)']),text('description','Описание ситуации','textarea'),text('evidenceList','Перечень демонстрационных подтверждений','textarea')],
 general:[select('category','Категория',['STUDY','FINANCE','PROFILE','OTHER'],['Учёба','Финансы','Ошибка в профиле','Другой вопрос']),text('subject','Тема'),text('description','Описание','textarea')],
 support:[text('subject','Тема'),text('description','Описание','textarea')],
};
export function fieldsSchema(slug:string,draft=false){const fields=formDefinitions[slug];if(!fields)throw Error('Unknown service');const shape:Record<string,z.ZodType>={};for(const f of fields){let schema:z.ZodType;if(f.type==='checkbox')schema=z.boolean();else if(f.type==='number')schema=z.number().int().min(1).max(10);else if(f.type==='achievements')schema=z.array(z.string().min(1).max(100)).max(10).refine(v=>new Set(v).size===v.length);else if(f.options)schema=z.enum(f.options.map(o=>o.value) as [string,...string[]]);else if(f.type==='date')schema=draft?z.union([z.iso.date(),z.literal('')]):z.iso.date();else schema=z.string().trim().max(f.type==='textarea'?2000:200).min(!draft&&f.required?1:0);shape[f.key]=draft||f.when?schema.optional():schema;}
return z.object(shape).strict().superRefine((v,ctx)=>{if(draft)return;if(v.format==='paper'&&!v.copies)ctx.addIssue({code:'custom',path:['copies'],message:'Укажите количество экземпляров.'});if(slug==='transcript'){if(v.latinConfirmed!==true)ctx.addIssue({code:'custom',path:['latinConfirmed'],message:'Подтвердите написание имени.'});if(!/^[A-Za-z '-]+$/.test(String(v.latinName)))ctx.addIssue({code:'custom',path:['latinName'],message:'Используйте латиницу.'});}if(v.startDate&&v.endDate&&String(v.endDate)<String(v.startDate))ctx.addIssue({code:'custom',path:['endDate'],message:'Конец периода раньше начала.'});if(slug==='scholarship'&&!(v.achievementIds as string[])?.length)ctx.addIssue({code:'custom',path:['achievementIds'],message:'Выберите подтверждённое достижение.'});});}
export function defaultFields(slug:string):Record<string,unknown>{const result:Record<string,unknown>={};for(const f of formDefinitions[slug]??[]){result[f.key]=f.key==='recipient'?'По месту требования':f.type==='checkbox'?false:f.type==='number'?1:f.type==='achievements'?[]:f.options?.[0]?.value??'';}return result;}
