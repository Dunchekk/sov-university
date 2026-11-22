import { LoginForm } from "./LoginForm";
import { brand, university } from "@/shared/config/brand";
import { BrandMark } from "@/shared/ui/BrandMark";
import s from "./login.module.css";

export const metadata = { title: "Вход в личный кабинет" };

export default function LoginPage() {
  return (
    <main className={s.page}>
      <section className={s.story}>
        <div className={s.brand}>
          <BrandMark />
          {brand.name}
        </div>
        <div>
          <h1 className={s.headline}>
            {university.type} <span>{university.disciplines}</span>
          </h1>
          <p className={s.sub}>
            Расписание занятий, оценки, учебные материалы и сервисы
            университета.
          </p>
        </div>
        <small className={s.note}>{brand.disclaimer}</small>
      </section>
      <section className={s.formSide}>
        <LoginForm />
      </section>
    </main>
  );
}
