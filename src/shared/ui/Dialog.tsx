'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './primitives';
import s from './ui.module.css';
export function Dialog({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open){dialog?.showModal();}else if(!open&&dialog?.open){dialog.close();}},[open]);
  return <dialog ref={ref} className={s.dialog} aria-label={title} onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className={s.dialogBody}><div className={s.between}><h2>{title}</h2><Button aria-label="Закрыть" onClick={onClose}><X size={18}/></Button></div>{children}</div></dialog>;
}
