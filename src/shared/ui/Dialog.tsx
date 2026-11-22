"use client";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "./primitives";
import s from "./ui.module.css";
// Preserve the last open content until the exit animation finishes, including
// callers that immediately clear their selected event or confirmation payload.
const DialogContent = memo(
  function DialogContent({
    title,
    subtitle,
    titleIcon,
    children,
    titleId,
    onClose,
    dismissible,
  }: {
    open: boolean;
    title: string;
    subtitle?: string;
    titleIcon?: ReactNode;
    children: ReactNode;
    titleId: string;
    onClose: () => void;
    dismissible: boolean;
  }) {
    const heading = (
      <div>
        <h2 id={titleId}>{title}</h2>
        {subtitle && (
          <p id={`${titleId}-description`} className={s.muted}>
            {subtitle}
          </p>
        )}
      </div>
    );
    return (
      <div className={s.dialogBody}>
        <div className={s.between}>
          {titleIcon ? (
            <div className={s.dialogHeading}>
              {titleIcon}
              {heading}
            </div>
          ) : (
            heading
          )}
          <Button
            type="button"
            className={s.icon}
            aria-label="Закрыть"
            disabled={!dismissible}
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    );
  },
  (_previous, next) => !next.open,
);

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  titleIcon,
  children,
  dismissible = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  titleIcon?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const callback = useRef(onClose);
  const desiredOpen = useRef(open);
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    outside: boolean;
  } | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const titleId = useId();

  useLayoutEffect(() => {
    callback.current = onClose;
    desiredOpen.current = open;
  }, [onClose, open]);

  const finishClose = useCallback(() => {
    const dialog = ref.current;
    if (!closing.current || !dialog) return;
    dialog.close();
    (dialog.firstElementChild as HTMLElement).inert = false;
    dialog.style.height = "";
    delete dialog.dataset.closing;
    closing.current = false;
    clearTimeout(exitTimer.current);
    if (desiredOpen.current) callback.current();
  }, []);

  const startExit = useCallback(() => {
    const dialog = ref.current;
    if (!dialog?.open || closing.current) return;
    dialog.style.height = `${dialog.getBoundingClientRect().height}px`;
    (dialog.firstElementChild as HTMLElement).inert = true;
    closing.current = true;
    dialog.dataset.closing = "true";
    exitTimer.current = setTimeout(
      finishClose,
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220,
    );
  }, [finishClose]);
  const requestClose = () => {
    if (dismissible) startExit();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      closing.current = false;
      clearTimeout(exitTimer.current);
      delete dialog.dataset.closing;
      dialog.style.height = "";
      (dialog.firstElementChild as HTMLElement).inert = false;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      startExit();
    }
  }, [open, startExit]);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  const outside = (x: number, y: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
  };
  return (
    <dialog
      ref={ref}
      className={className ? `${s.dialog} ${className}` : s.dialog}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? `${titleId}-description` : undefined}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        requestClose();
      }}
      onKeyDownCapture={(e) => {
        if ((e.target as Element).closest("dialog") !== e.currentTarget) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          requestClose();
        } else if (closing.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onSubmitCapture={(e) => {
        if ((e.target as Element).closest("dialog") !== e.currentTarget) return;
        if (closing.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && closing.current) finishClose();
      }}
      onPointerDown={(e) => {
        pointer.current =
          e.button === 0
            ? {
                id: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                outside:
                  e.target === e.currentTarget && outside(e.clientX, e.clientY),
              }
            : null;
      }}
      onPointerUp={(e) => {
        const start = pointer.current;
        pointer.current = null;
        if (
          start?.outside &&
          start.id === e.pointerId &&
          outside(e.clientX, e.clientY) &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8
        )
          requestClose();
      }}
      onPointerMove={(e) => {
        const start = pointer.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 8)
          pointer.current = null;
      }}
      onPointerCancel={() => {
        pointer.current = null;
      }}
    >
      <DialogContent
        open={open}
        title={title}
        subtitle={subtitle}
        titleIcon={titleIcon}
        titleId={titleId}
        onClose={requestClose}
        dismissible={dismissible}
      >
        {children}
      </DialogContent>
    </dialog>
  );
}
