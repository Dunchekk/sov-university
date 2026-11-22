"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button, ui } from "./primitives";
export function CopyButton({
  value,
  label = "Скопировать",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  return (
    <span className={ui.row}>
      <Button
        small
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setError("");
          } catch {
            setError("Копирование недоступно. Выделите значение вручную.");
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
        {copied ? "Скопировано" : label}
      </Button>
      <span role="status" className={ui.srOnly}>
        {copied && !error ? "Скопировано в буфер обмена." : ""}
      </span>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
