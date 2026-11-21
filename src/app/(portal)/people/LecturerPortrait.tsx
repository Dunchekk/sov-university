import Image from "next/image";
import { Avatar } from "@/shared/ui/primitives";
import s from "./people.module.css";

export function LecturerPortrait({
  name,
  src,
  large = false,
}: {
  name: string;
  src?: string;
  large?: boolean;
}) {
  return (
    <span className={large ? s.profilePortrait : s.rowPortrait}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={large ? "(max-width: 600px) 82px, 150px" : "52px"}
          loading={large ? "eager" : "lazy"}
        />
      ) : (
        <Avatar name={name} />
      )}
    </span>
  );
}
