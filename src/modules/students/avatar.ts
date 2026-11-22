export const avatarEndpoint = "/api/me/avatar";
export const avatarPurpose = "PROFILE_AVATAR";
export const avatarFormats = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const avatarMaxBytes = 5 * 1024 * 1024;

export function uploadedAvatarSrc(id: string) {
  return `${avatarEndpoint}?v=${id}`;
}

export function profileAvatarSrc(image?: string | null) {
  if (!image) return null;
  const seeded = /^\/people\/students\/[\w-]+\.(?:jpg|jpeg|png|webp)$/i;
  const uploaded =
    /^\/api\/me\/avatar\?v=[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
  return seeded.test(image) || uploaded.test(image) ? image : null;
}
