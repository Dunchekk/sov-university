import Link from "next/link";
import { ui } from "./primitives";

export function LecturerLink({ id, name }: { id?: string; name: string }) {
  return id ? (
    <Link
      className={ui.link}
      href={`/people/${encodeURIComponent(id)}`}
      prefetch={false}
    >
      {name}
    </Link>
  ) : (
    name
  );
}
