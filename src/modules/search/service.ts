import {db} from '@/server/db';
import type {StudentContext} from '@/server/access';
export async function search(student:StudentContext,q:string){
 const term=q.trim().slice(0,80);if(term.length<2)return [];
 const contains={contains:term,mode:'insensitive' as const};
 const [courses,people,departments,services,events]=await Promise.all([
 db.course.findMany({where:{enrollments:{some:{studentId:student.id}},name:contains},select:{id:true,name:true},take:5}),
 db.person.findMany({where:{name:contains},select:{id:true,name:true},take:5}),
 db.department.findMany({where:{OR:[{name:contains},{description:contains}]},select:{id:true,name:true},take:5}),
 db.service.findMany({where:{active:true,OR:[{title:contains},{keywords:contains}]},select:{slug:true,title:true},take:5}),
 db.communityEvent.findMany({where:{AND:[{OR:[{groupId:null},{groupId:student.groupId}]},{title:contains}]},select:{id:true,title:true},take:5})]);
 return [...courses.map(v=>({id:v.id,title:v.name,type:'Дисциплины',href:`/studies/courses/${v.id}`})),...people.map(v=>({id:v.id,title:v.name,type:'Преподаватели',href:`/people?q=${encodeURIComponent(v.name)}`})),...departments.map(v=>({id:v.id,title:v.name,type:'Подразделения',href:`/people?tab=departments&q=${encodeURIComponent(v.name)}`})),...services.map(v=>({id:v.slug,title:v.title,type:'Услуги',href:`/services/${v.slug}`})),...events.map(v=>({id:v.id,title:v.title,type:'События',href:`/community/${v.id}`}))];
}
