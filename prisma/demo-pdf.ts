import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
export async function demoPdf(title: string, lines: string[]) {
  const document = await PDFDocument.create(); document.registerFontkit(fontkit);
  const font = await document.embedFont(await readFile('public/fonts/Inter-Regular.ttf'), { subset: false });
  const page = document.addPage([595,842]);
  page.drawText('РЯДОМ / УНИВЕРСИТЕТ СЕВЕРНЫЙ', { x:48,y:780,size:11,font,color:rgb(.28,.30,.34) });
  page.drawRectangle({ x:48,y:714,width:499,height:40,color:rgb(.95,.96,.98) });
  page.drawText('Демонстрационный документ', { x:62,y:738,size:12,font,color:rgb(.15,.25,.4) });
  page.drawText('Не является официальной справкой', { x:62,y:722,size:10,font,color:rgb(.15,.25,.4) });
  let y=675;
  const drawWrapped=(text:string,size:number)=>{ let line=''; for(const word of text.split(' ')){ const next=line ? `${line} ${word}` : word; if(font.widthOfTextAtSize(next,size)>495){page.drawText(line,{x:48,y,size,font});y-=size+8;line=word;}else line=next;}if(line){page.drawText(line,{x:48,y,size,font});y-=size+12;} };
  drawWrapped(title,20); y-=14;
  for(const line of lines) drawWrapped(line,12);
  page.drawLine({ start:{x:48,y:100},end:{x:547,y:100},thickness:1,color:rgb(.85,.86,.88) });
  page.drawText('Все сведения вымышлены. Печатей и подписей нет.',{x:48,y:80,size:10,font,color:rgb(.35,.36,.4)});
  document.setTitle(title); document.setAuthor('Рядом — учебный прототип');
  return Buffer.from(await document.save());
}
