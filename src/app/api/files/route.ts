import { route } from "@/server/http";
import { uploadFile } from "@/modules/files/service";
export const POST = route(uploadFile);
