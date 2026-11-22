import Link from "next/link";
import { ArrowUpRight, Download, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { db } from "@/server/db";
import { ui } from "@/shared/ui/primitives";
import { PrivateDetails } from "./PrivateDetails";
import s from "./profile.module.css";

export async function ProfileDocuments({ studentId }: { studentId: string }) {
  const [contracts, results] = await Promise.all([
    db.contract.findMany({
      where: { studentId },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        title: true,
        files: {
          where: { studentId, purpose: "CONTRACT", mime: "application/pdf" },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          select: { id: true, originalName: true },
        },
      },
    }),
    db.fileObject.findMany({
      where: {
        studentId,
        purpose: "REQUEST_RESULT",
        mime: "application/pdf",
        request: {
          is: {
            studentId,
            status: "READY",
            OR: [
              { resultExpiresAt: null },
              { resultExpiresAt: { gt: new Date() } },
            ],
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        originalName: true,
        request: { select: { id: true, number: true } },
      },
    }),
  ]);

  return (
    <div className={ui.stack}>
      <section className={s.panel} aria-labelledby="profile-contracts">
        <h2 id="profile-contracts">Договоры об обучении</h2>
        {contracts.length ? (
          <ul className={s.documents}>
            {contracts.flatMap(({ id, number, title, files }) =>
              files.length
                ? files.map((file) => (
                    <DocumentRow
                      key={file.id}
                      title={file.originalName.replace(/\.pdf$/i, "")}
                      fileId={file.id}
                    >
                      № {number} · PDF
                    </DocumentRow>
                  ))
                : [
                    <DocumentRow key={id} title={title}>
                      № {number} · PDF пока недоступен
                    </DocumentRow>,
                  ],
            )}
          </ul>
        ) : (
          <p className={`${ui.muted} ${s.empty}`}>
            Договоров об оплате обучения нет.
          </p>
        )}
      </section>

      <section className={s.panel} aria-labelledby="profile-issued-documents">
        <h2 id="profile-issued-documents">Справки и выписки</h2>
        {results.length ? (
          <ul className={s.documents}>
            {results.map(({ id, originalName, request }) => (
              <DocumentRow
                key={id}
                title={originalName.replace(/\.pdf$/i, "")}
                fileId={id}
              >
                {request && (
                  <Link
                    className={s.textLink}
                    href={`/requests/${encodeURIComponent(request.id)}`}
                  >
                    Обращение № {String(request.number).padStart(5, "0")}
                  </Link>
                )}
              </DocumentRow>
            ))}
          </ul>
        ) : (
          <p className={`${ui.muted} ${s.empty}`}>
            Здесь появятся готовые документы из обращений.
          </p>
        )}
        <div className={s.panelFooter}>
          <Link className={s.textLink} href="/services?tab=requests">
            Мои обращения <ArrowUpRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <section className={s.panel} aria-labelledby="profile-private-details">
        <h2 id="profile-private-details">Личные сведения</h2>
        <PrivateDetails kind="documents" />
      </section>
    </div>
  );
}

function DocumentRow({
  title,
  fileId,
  children,
}: {
  title: string;
  fileId?: string;
  children: ReactNode;
}) {
  return (
    <li className={s.document}>
      <span className={s.fileIcon}>
        <FileText size={19} aria-hidden />
      </span>
      <div>
        <h3>{title}</h3>
        <p className={ui.caption}>{children}</p>
      </div>
      {fileId && (
        <a
          className={ui.button}
          href={`/api/files/${encodeURIComponent(fileId)}`}
          aria-label={`Скачать PDF — ${title}`}
        >
          <Download size={16} aria-hidden /> Скачать PDF
        </a>
      )}
    </li>
  );
}
