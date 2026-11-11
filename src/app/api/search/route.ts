import {route} from '@/server/http';
import {search} from '@/modules/search/service';
export const GET=route(async(request,student)=>search(student,new URL(request.url).searchParams.get('q')??''));
