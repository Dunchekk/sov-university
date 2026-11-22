import { Empty, ActionLink } from "@/shared/ui/primitives";
export default function NotFound() {
  return (
    <Empty
      heading="h1"
      title="Страница не найдена"
      description="Ссылка устарела или у вас нет доступа к этому объекту."
      action={<ActionLink href="/">На главную</ActionLink>}
    />
  );
}
