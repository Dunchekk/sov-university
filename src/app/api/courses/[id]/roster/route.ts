import {route} from '@/server/http';
import {roster} from '@/modules/courses/service';
export const GET=route(async(request,student)=>{const url=new URL(request.url);return roster(student,url.pathname.split('/')[3],url.searchParams.get('q')??'',url.searchParams.get('group')??undefined,Number(url.searchParams.get('page')??1)||1);});
