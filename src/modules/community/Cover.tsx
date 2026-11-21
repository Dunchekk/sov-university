import Image from "next/image";
import s from "./community.module.css";

export function Cover({ src, sizes }: { src: string; sizes: string }) {
  return <Image src={src} className={s.cover} alt="" fill sizes={sizes} />;
}
