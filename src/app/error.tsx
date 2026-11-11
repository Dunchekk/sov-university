'use client';
import { Button,Empty } from '@/shared/ui/primitives';
export default function ErrorPage({reset}:{reset:()=>void}){return <Empty title="Не удалось загрузить раздел" description="Попробуйте повторить запрос. Остальные разделы доступны из меню." action={<Button onClick={reset}>Повторить</Button>}/>}
