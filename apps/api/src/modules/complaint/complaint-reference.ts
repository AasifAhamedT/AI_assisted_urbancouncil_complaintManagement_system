import { randomInt } from "node:crypto";

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const generateComplaintReference = (date = new Date()): string => {
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    suffix += alphabet[randomInt(alphabet.length)];
  }
  return `KUC-${date.getUTCFullYear()}-${suffix}`;
};
