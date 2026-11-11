import type { Metadata } from 'next';
import { cookies,headers } from 'next/headers';
import { brand } from '@/shared/config/brand';
import '@/shared/styles/globals.css';
export const metadata: Metadata={title:{default:`${brand.name} — личный кабинет`,template:`%s · ${brand.name}`},description:'Учёба, расписание и важное — рядом.',robots:{index:false,follow:false}};
export default async function RootLayout({children}:{children:React.ReactNode}){
  const cookie=(await cookies()).get('theme')?.value; const preference=['light','dark'].includes(cookie??'')?cookie:'system'; const nonce=(await headers()).get('x-nonce')??undefined;
  return <html lang="ru" data-theme={preference==='dark'?'dark':'light'} suppressHydrationWarning><head>{preference==='system'&&<script nonce={nonce} dangerouslySetInnerHTML={{__html:"document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';"}}/>}</head><body>{children}</body></html>;
}
