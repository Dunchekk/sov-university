import { route, jsonBody } from "@/server/http";
import { submissionSchema, submitProject } from "@/modules/projects/service";
export const POST = route(async (request, student) =>
  submitProject(
    student,
    new URL(request.url).pathname.split("/")[3],
    await jsonBody(request, submissionSchema),
  ),
);
