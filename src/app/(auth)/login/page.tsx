import { LoginForm } from "./LoginForm";
import { brand } from "@/shared/config/brand";
import s from "./login.module.css";
export default function LoginPage() {
  return (
    <main className={s.page}>
      <section className={s.story}>
        <div className={s.brand}>
          <span className={s.mark}>{brand.mark}</span>
          {brand.name}
        </div>
        <div>
          <h2 className={s.headline}>
            Твоя учёба.
            <br />
            Всё важное.
            <br />
            Рядом.
          </h2>
          <p className={s.sub}>
            Расписание, результаты и следующий шаг — в одном спокойном
            пространстве.
          </p>
          <div className={s.orbit}>
            <span className={s.pill}>Сегодня и дальше</span>
            <span className={s.pill}>Понятные оценки</span>
            <span className={s.pill}>Меньше формальностей</span>
          </div>
        </div>
        <small>{brand.disclaimer}</small>
      </section>
      <section className={s.formSide}>
        <LoginForm />
      </section>
    </main>
  );
}
