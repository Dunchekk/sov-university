import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import { db } from "../../src/server/db";
const key = () => randomUUID();
test("requests persist, submit is idempotent, foreign access and employee actions are denied", async ({
  student,
  other,
}) => {
  const creation = {
    serviceSlug: "enrollment",
    fields: {
      recipient: "QA по месту требования",
      language: "ru",
      format: "paper",
      copies: 2,
    },
    key: key(),
  };
  const create = await student.post("/api/requests", { data: creation });
  expect(create.status()).toBe(200);
  const draft = await create.json();
  const duplicate = await student.post("/api/requests", { data: creation });
  expect((await duplicate.json()).id).toBe(draft.id);
  const conflict = await student.post("/api/requests", {
    data: { ...creation, fields: { ...creation.fields, copies: 3 } },
  });
  expect(conflict.status()).toBe(409);
  expect((await other.get(`/api/requests/${draft.id}`)).status()).toBe(404);
  expect(
    (
      await student.patch(`/api/requests/${draft.id}`, {
        data: { fields: creation.fields, version: 999 },
      })
    ).status(),
  ).toBe(409);
  const submit = { action: "submit", version: 0, key: key() };
  const results = await Promise.all([
    student.post(`/api/requests/${draft.id}`, { data: submit }),
    student.post(`/api/requests/${draft.id}`, { data: submit }),
  ]);
  for (const result of results) expect(result.status()).toBe(200);
  const item = await (await student.get(`/api/requests/${draft.id}`)).json();
  expect(item.status).toBe("SUBMITTED");
  expect(
    item.history.filter((h: { status: string }) => h.status === "SUBMITTED"),
  ).toHaveLength(1);
  expect(item.fields.copies).toBe(2);
  expect(
    (
      await student.post(`/api/requests/${draft.id}`, {
        data: { action: "READY", version: 1, key: key() },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await other.post(`/api/requests/${draft.id}`, {
        data: { action: "cancel", version: 1, key: key() },
      })
    ).status(),
  ).toBe(404);
  const cancelled = await student.post(`/api/requests/${draft.id}`, {
    data: { action: "cancel", version: 1, key: key() },
  });
  expect(cancelled.status()).toBe(200);
});
test("ownership protects course data, files, profile and finance", async ({
  student,
  other,
  request,
}) => {
  for (const path of [
    "/api/courses/course-0/results",
    "/api/courses/course-0/roster",
    "/api/projects/project-0",
    "/api/files/submission-file-0",
    "/api/files/result-3",
    "/api/achievements/achievement-0",
  ])
    expect((await other.get(path)).status(), path).toBe(404);
  expect((await other.get("/api/courses/course-1/roster")).status()).toBe(200);
  const roster = await (await other.get("/api/courses/course-1/roster")).json();
  expect(JSON.stringify(roster)).not.toMatch(
    /contactEmail|document|personal.example/,
  );
  const a = await (await student.get("/api/finance")).json(),
    b = await (await other.get("/api/finance")).json();
  expect(a.contracts).toHaveLength(0);
  expect(b.contracts).toHaveLength(1);
  expect(b.payments).toHaveLength(0);
  const me = await (await student.get("/api/me")).json();
  expect(JSON.stringify(me)).not.toContain("DEMO-000001");
  const privateB = await (
    await other.get("/api/me/private-details?studentId=student-a")
  ).json();
  expect(privateB.document).toBe("DEMO-000002");
  expect((await request.get("/api/me/private-details")).status()).toBe(401);
  const badOwner = await student.post("/api/requests", {
    data: {
      serviceSlug: "enrollment",
      fields: {},
      key: key(),
      studentId: "student-b",
    },
  });
  expect(badOwner.status()).toBe(422);
});
test("project report is private, validated and versioned without duplicate sends", async ({
  student,
  other,
}) => {
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/ryadom_test");
  const projectId = `test-project-${key()}`;
  await db.studentProject.create({
    data: {
      id: projectId,
      studentId: "student-a",
      title: "Проверка версий",
      kind: "Практика",
      semester: 3,
      supervisorId: "lecturer-0",
      description: "Тест",
      requirements: "PDF",
      status: "OPEN",
      dueAt: new Date(Date.now() + 86400000),
      startsAt: new Date(),
    },
  });
  const project = await (
    await student.get(`/api/projects/${projectId}`)
  ).json();
  const pdf = await readFile(".data/test-files/seed-submission-file-0");
  const foreign = await other.post("/api/files", {
    multipart: {
      purpose: "PROJECT_UPLOAD",
      resourceId: projectId,
      file: { name: "report.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(foreign.status()).toBe(404);
  const bad = await student.post("/api/files", {
    multipart: {
      purpose: "PROJECT_UPLOAD",
      resourceId: projectId,
      file: {
        name: "bad.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("<html>not PDF</html>"),
      },
    },
  });
  expect(bad.status()).toBe(422);
  const upload = await student.post("/api/files", {
    multipart: {
      purpose: "PROJECT_UPLOAD",
      resourceId: projectId,
      file: { name: "report.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  expect(upload.status()).toBe(200);
  const file = await upload.json();
  expect((await other.get(`/api/files/${file.id}`)).status()).toBe(404);
  const submission = {
    fileId: file.id,
    comment: "Версия для проверки",
    key: key(),
    version: project.version,
  };
  const [one, two] = await Promise.all([
    student.post(`/api/projects/${projectId}/submit`, { data: submission }),
    student.post(`/api/projects/${projectId}/submit`, { data: submission }),
  ]);
  expect(one.status()).toBe(200);
  expect(two.status()).toBe(200);
  expect(await one.json()).toEqual(await two.json());
  const updated = await (
    await student.get(`/api/projects/${projectId}`)
  ).json();
  expect(updated.submissions.length).toBe(project.submissions.length + 1);
  expect((await student.delete(`/api/files/${file.id}`)).status()).toBe(409);
  await db.studentProject.update({
    where: { id: projectId },
    data: { status: "REVISION", version: { increment: 1 } },
  });
  const upload2 = await student.post("/api/files", {
    multipart: {
      purpose: "PROJECT_UPLOAD",
      resourceId: projectId,
      file: { name: "report-v2.pdf", mimeType: "application/pdf", buffer: pdf },
    },
  });
  const f2 = await upload2.json();
  const v2 = await student.post(`/api/projects/${projectId}/submit`, {
    data: {
      fileId: f2.id,
      comment: "Исправленная версия",
      key: key(),
      version: 2,
    },
  });
  expect(v2.status()).toBe(200);
  const final = await (await student.get(`/api/projects/${projectId}`)).json();
  expect(final.submissions.map((v: { version: number }) => v.version)).toEqual([
    2, 1,
  ]);
});
test("achievement draft and submit work; student cannot confirm it", async ({
  student,
  other,
}) => {
  const data = {
    title: `Учебный проект ${key()}`,
    category: "Учёба",
    date: "2026-11-11",
    description: "Описание результата",
    organizer: "Учебная лаборатория",
    coauthors: "",
    evidenceUrl: "https://example.org/evidence",
    key: key(),
  };
  const created = await student.post("/api/achievements", { data });
  expect(created.status()).toBe(200);
  const item = await created.json();
  expect((await other.get(`/api/achievements/${item.id}`)).status()).toBe(404);
  expect(
    (
      await student.post(`/api/achievements/${item.id}`, {
        data: { action: "confirm", version: 0, key: key() },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await student.post(`/api/achievements/${item.id}`, {
        data: { action: "submit", version: 0, key: key() },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await student.get(`/api/achievements/${item.id}`)).json()).status,
  ).toBe("SUBMITTED");
});
test("conditional form, draft refresh and actual submission in browser", async ({
  studentPage: page,
}) => {
  await page.goto("/services/enrollment");
  await page
    .getByLabel("Способ получения", { exact: true })
    .selectOption("paper");
  await page.getByLabel("Количество экземпляров").fill("2");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Черновик сохранён");
  await page.reload();
  await expect(page.getByLabel("Количество экземпляров")).toHaveValue("2");
  await page.getByRole("button", { name: "Проверить и отправить" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отправить обращение" })
    .click();
  await expect(page).toHaveURL(/\/requests\//);
  await expect(
    page.getByRole("heading", { name: "Следующий шаг" }),
  ).toBeVisible();
  await expect(
    page.getByText("Обращение принято. Ожидайте рассмотрения.").first(),
  ).toBeVisible();
});
test("achievement retries the same submit after lost server response", async ({
  studentPage: page,
}) => {
  await page.goto("/studies/achievements/new");
  await page
    .getByLabel("Название", { exact: true })
    .fill(`Достижение ${key()}`);
  await page
    .getByLabel("Описание", { exact: true })
    .fill("Исследовательский результат");
  await page
    .getByLabel("Организатор", { exact: true })
    .fill("Учебная лаборатория");
  await page
    .getByLabel("Подтверждающая HTTPS-ссылка")
    .fill("https://example.org/proof");
  let lost = false,
    patchesAfterLoss = 0;
  await page.route("**/api/achievements/*", async (route) => {
    if (route.request().method() === "PATCH" && lost) patchesAfterLoss++;
    if (route.request().method() === "POST" && !lost) {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      lost = true;
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Отправить на проверку", exact: true })
    .click();
  await expect(
    page.getByText("Отправка не подтверждена.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отправить на проверку", exact: true })
    .click();
  await expect(page).toHaveURL(/\/studies\/achievements\/(?!new)/);
  await expect(
    page.getByText("Достижение ожидает проверки.", { exact: false }),
  ).toBeVisible();
  expect(patchesAfterLoss).toBe(0);
});
test("request preview waits for an immutable saved snapshot", async ({
  studentPage: page,
  student,
}) => {
  const created = await student.post("/api/requests", {
    data: {
      serviceSlug: "enrollment",
      fields: {
        recipient: "Исходный получатель",
        language: "ru",
        format: "electronic",
        copies: 1,
      },
      key: key(),
    },
  });
  const draft = await created.json();
  await page.goto(`/services/enrollment?draft=${draft.id}`);
  await page
    .getByLabel("Получатель", { exact: true })
    .fill("Сохранённый получатель");
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(`**/api/requests/${draft.id}`, async (route) => {
    if (route.request().method() === "PATCH") await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Проверить и отправить" }).click();
  await expect(page.getByLabel("Получатель", { exact: true })).toBeDisabled();
  release();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Сохранённый получатель", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
});
