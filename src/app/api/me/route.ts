import { route } from '@/server/http';
export const GET = route(async (_request, student) => ({ id: student.id, name: student.name, email: student.email, group: student.group.name, program: student.group.program.name, funding: student.funding }));
