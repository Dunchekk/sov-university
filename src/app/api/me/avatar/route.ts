import { route } from "@/server/http";
import {
  readAvatar,
  removeAvatar,
  uploadAvatar,
} from "@/modules/students/avatar-service";

export const GET = route(readAvatar);
export const POST = route(uploadAvatar);
export const DELETE = route((_request, student) => removeAvatar(student));
