import {
  ArrowDownToLine,
  AudioLines,
  FileText,
  Presentation,
} from "lucide-react";
import { Card, ui } from "@/shared/ui/primitives";
import { courseMaterialTypes } from "./materials";
import s from "./materials.module.css";

type CourseFile = {
  id: string;
  purpose: string;
  mime: string;
  originalName: string;
  size: number;
};

const icons = {
  COURSE_PRESENTATION: Presentation,
  COURSE_TRANSCRIPT: FileText,
  COURSE_RECORDING: AudioLines,
};

export function CourseMaterials({ files }: { files: CourseFile[] }) {
  const groups = courseMaterialTypes
    .map((type) => ({
      ...type,
      files: files.filter(
        (file) => file.purpose === type.purpose && file.mime === type.mime,
      ),
    }))
    .filter((group) => group.files.length);

  return (
    <Card className={s.materials}>
      <h2>Материалы курса</h2>
      {groups.length ? (
        <div className={s.groups}>
          {groups.map((group) => {
            const Icon = icons[group.purpose];
            return (
              <section key={group.purpose} className={s.group}>
                <h3>{group.title}</h3>
                <ul>
                  {group.files.map((file) => (
                    <li id={`material-${file.id}`} key={file.id}>
                      <a href={`/api/files/${file.id}`} className={s.file}>
                        <Icon size={19} aria-hidden="true" />
                        <span>
                          {file.originalName.replace(/\.[^.]+$/, "")}
                          <span className={ui.caption}>
                            {group.format} · {Math.ceil(file.size / 1024)} КБ
                          </span>
                        </span>
                        <ArrowDownToLine
                          size={17}
                          aria-hidden="true"
                          className={s.download}
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className={ui.muted}>Материалы пока не опубликованы.</p>
      )}
    </Card>
  );
}
