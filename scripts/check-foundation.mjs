import {readFile} from 'node:fs/promises';
const accounts=JSON.parse(await readFile('.local/demo-credentials.json','utf8'));
const base='http://localhost:3000';
const check=(condition,message)=>{if(!condition)throw Error(message);console.log(`OK ${message}`);};
check((await fetch(`${base}/api/me`)).status===401,'anonymous API denied');
let cookieA='';
for(const [id,account] of Object.entries(accounts)){
 const response=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(account)});
 const data=await response.json();check(response.ok,`sign in ${id}: ${response.status} ${data.message??''}`);
 const cookie=response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');if(id==='student-a')cookieA=cookie;
 const me=await fetch(`${base}/api/me`,{headers:{Cookie:cookie}});const profile=await me.json();check(profile.id===id,`own profile ${id}`);check(!JSON.stringify(profile).includes('DEMO-00000'),'public DTO omits private details');
 const file=await fetch(`${base}/api/files/result-3`,{headers:{Cookie:cookie}});check(file.status===(id==='student-a'?200:404),`file ownership ${id}`);
}
check((await fetch(`${base}/api/auth/sign-up/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'})).status===404,'signup closed');
check((await fetch(`${base}/api/auth/sign-out`,{method:'POST',headers:{Cookie:cookieA,Origin:'https://untrusted.example'}})).status===403,'foreign origin rejected');
const logout=await fetch(`${base}/api/auth/sign-out`,{method:'POST',headers:{Cookie:cookieA,Origin:base,'Content-Type':'application/json'},body:'{}'});check(logout.ok,'logout');check((await fetch(`${base}/api/me`,{headers:{Cookie:cookieA}})).status===401,'old session revoked');
