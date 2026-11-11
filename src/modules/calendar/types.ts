export const eventTypes=['LESSON','DEADLINE','EXAM','COMMUNITY','PERSONAL'] as const;
export type EventType=typeof eventTypes[number];
export const eventLabels:Record<EventType,string>={LESSON:'Пара',DEADLINE:'Дедлайн',EXAM:'Экзамен',COMMUNITY:'Событие',PERSONAL:'Личное'};
export type CalendarEvent={id:string;uid:string;type:EventType;title:string;description:string;startsAt:string|null;endsAt:string|null;startDate:string|null;endDate:string|null;timezone:string;location:string;lecturer?:string;group?:string;courseId?:string;href?:string;url?:string;source:string;sourceId?:string;comparison:boolean;cancelled:boolean;sequence:number;updatedAt:string;changes?:{kind:string;before:string;after:string;createdAt:string}[];editable:boolean;status?:string};
export type ScheduleSelection={kind:'group'|'lecturer'|'room';id:string};
