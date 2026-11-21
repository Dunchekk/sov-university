export const courseMaterialTypes = [
  {
    purpose: "COURSE_PRESENTATION",
    title: "Презентации",
    format: "PDF",
    mime: "application/pdf",
    extension: "pdf",
  },
  {
    purpose: "COURSE_TRANSCRIPT",
    title: "Расшифровки",
    format: "TXT",
    mime: "text/plain; charset=utf-8",
    extension: "txt",
  },
  {
    purpose: "COURSE_RECORDING",
    title: "Записи встреч",
    format: "M4A",
    mime: "audio/mp4",
    extension: "m4a",
  },
] as const;
