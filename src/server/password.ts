import { hash, verify } from "@node-rs/argon2";
export const hashPassword = (password: string) =>
  hash(password, {
    algorithm: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    outputLen: 32,
  });
export const verifyPassword = ({
  hash: digest,
  password,
}: {
  hash: string;
  password: string;
}) => verify(digest, password);
