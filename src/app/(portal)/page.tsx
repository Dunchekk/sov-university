import { pageStudent } from '@/server/access';
import { Card,PageTitle,ui } from '@/shared/ui/primitives';
export default async function Home(){const student=await pageStudent();return <main style={{padding:'var(--space-10)'}}><PageTitle title="Сегодня" description={`Добро пожаловать, ${student.name.split(' ')[0]}`}/><Card><h2>Твоя учёба — рядом</h2><p className={ui.muted}>{student.group.program.name} · {student.group.name}</p></Card></main>}
