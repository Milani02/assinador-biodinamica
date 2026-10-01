import { randomBytes } from "node:crypto";

export function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}
