import {chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const {['student-a']:account}=JSON.parse(await readFile('.local/demo-credentials.json','utf8'));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://localhost:3000/login');await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Пароль',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Войти в кабинет'}).click();await page.waitForURL('http://localhost:3000/');await page.getByRole('heading',{name:'Сегодня',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
await mkdir('.local/screenshots',{recursive:true});await page.screenshot({path:'.local/screenshots/home-light.png',fullPage:true,caret:'initial'});
await page.goto('http://localhost:3000/calendar?view=week');await page.getByRole('heading',{name:'Календарь',exact:true}).waitFor();await page.screenshot({path:'.local/screenshots/calendar-light.png',fullPage:true,caret:'initial'});
await page.goto('http://localhost:3000/studies/results');await page.getByRole('heading',{name:'Оценки и посещаемость',exact:true}).waitFor();console.log(JSON.stringify({errors}));await browser.close();
