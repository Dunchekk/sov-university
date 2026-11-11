import {route} from '@/server/http';
import {courseResult} from '@/modules/courses/service';
export const GET=route(async(request,student)=>{const result=await courseResult(student,new URL(request.url).pathname.split('/')[3]);return {grade:result.grade,attendance:result.attendance,officialGrade:result.enrollment.officialGrade};});
