"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { filterHref } from "@/shared/lib/filters";

export function FilterForm({
  action,
  resetHref,
  children,
  ...props
}: Pick<ComponentProps<"form">, "className" | "aria-label" | "children"> & {
  action: string;
  resetHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      {...props}
      action={action}
      method="get"
      aria-busy={pending}
      onReset={
        resetHref
          ? () => {
              startTransition(() => router.push(resetHref, { scroll: false }));
            }
          : undefined
      }
      onChange={(event) => {
        const field = event.target;
        if (
          field instanceof HTMLSelectElement ||
          (field instanceof HTMLInputElement && field.type === "checkbox")
        )
          event.currentTarget.requestSubmit();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries(
          Array.from(new FormData(event.currentTarget), ([name, value]) => [
            name,
            String(value),
          ]),
        );
        startTransition(() =>
          router.push(filterHref(action, values), { scroll: false }),
        );
      }}
    >
      {children}
    </form>
  );
}

// Keep the native control focused when the applied query changes, including Back.
function useFilterValue<T extends string | boolean>(applied: T) {
  const [state, setState] = useState({ applied, value: applied });
  if (applied !== state.applied) setState({ applied, value: applied });
  return [
    state.applied === applied ? state.value : applied,
    (value: T) => setState({ applied, value }),
  ] as const;
}

export function FilterSelect({
  value,
  ...props
}: Pick<ComponentProps<"select">, "name" | "children"> & { value: string }) {
  const [selected, setSelected] = useFilterValue(value);
  return (
    <select
      {...props}
      value={selected}
      onChange={(event) => setSelected(event.target.value)}
    />
  );
}

export function FilterText({
  value,
  ...props
}: Pick<
  ComponentProps<"input">,
  "name" | "placeholder" | "maxLength" | "aria-label" | "className"
> & {
  value: string;
}) {
  const [text, setText] = useFilterValue(value);
  return (
    <input
      {...props}
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
  );
}

export function FilterCheckbox({
  name,
  checked,
}: {
  name: string;
  checked: boolean;
}) {
  const [selected, setSelected] = useFilterValue(checked);
  return (
    <input
      type="checkbox"
      name={name}
      value="true"
      checked={selected}
      onChange={(event) => setSelected(event.target.checked)}
    />
  );
}
