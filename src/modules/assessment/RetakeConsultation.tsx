import { LecturerLink } from "@/shared/ui/LecturerLink";
import { ui } from "@/shared/ui/primitives";

export type Consultation = {
  text: string;
  lecturer: { id: string; name: string } | null;
};

export function RetakeConsultation({ text, lecturer }: Consultation) {
  return (
    <p className={ui.caption}>
      {lecturer && (
        <>
          Консультация · <LecturerLink {...lecturer} />.{" "}
        </>
      )}
      {text}
    </p>
  );
}
