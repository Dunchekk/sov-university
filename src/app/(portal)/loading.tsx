import { ui } from "@/shared/ui/primitives";
export default function Loading() {
  return (
    <div className={ui.stack} aria-label="Загрузка">
      <div className={ui.skeleton} />
      <div className={ui.skeleton} />
    </div>
  );
}
