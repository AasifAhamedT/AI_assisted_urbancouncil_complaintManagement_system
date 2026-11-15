import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { AppError } from "../../common/app-error.js";
import { env } from "../../config/env.js";

const mediaTypes = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"]
} as const;

type AllowedMediaType = keyof typeof mediaTypes;

const hasExpectedSignature = (mediaType: AllowedMediaType, content: Buffer): boolean => {
  if (mediaType === "image/jpeg") {
    return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  }
  if (mediaType === "image/png") {
    return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mediaType === "image/webp") {
    return content.subarray(0, 4).toString("ascii") === "RIFF" &&
      content.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return content.subarray(0, 5).toString("ascii") === "%PDF-";
};

export class AttachmentStorageService {
  private readonly root: string;

  constructor() {
    const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    this.root = isAbsolute(env.ATTACHMENT_STORAGE_PATH)
      ? resolve(env.ATTACHMENT_STORAGE_PATH)
      : resolve(apiRoot, env.ATTACHMENT_STORAGE_PATH);
  }

  async store(input: {
    complaintId: string;
    originalFilename: string;
    mediaType: string;
    content: Buffer;
  }): Promise<{ storageKey: string; checksumSha256: string; sizeBytes: number }> {
    const filename = input.originalFilename.trim();
    if (!filename || filename.length > 255 || basename(filename) !== filename || filename.includes("\0")) {
      throw new AppError(400, "INVALID_ATTACHMENT_FILENAME", "The attachment filename is invalid.");
    }
    if (!Buffer.isBuffer(input.content) || input.content.length === 0) {
      throw new AppError(400, "EMPTY_ATTACHMENT", "The uploaded attachment is empty.");
    }
    if (input.content.length > env.MAX_ATTACHMENT_BYTES) {
      throw new AppError(413, "ATTACHMENT_TOO_LARGE", "The uploaded attachment is too large.");
    }
    if (!(input.mediaType in mediaTypes)) {
      throw new AppError(415, "UNSUPPORTED_ATTACHMENT_TYPE", "Only JPEG, PNG, WebP, and PDF files are allowed.");
    }
    const mediaType = input.mediaType as AllowedMediaType;
    const extension = extname(filename).toLowerCase();
    if (!(mediaTypes[mediaType] as readonly string[]).includes(extension) ||
        !hasExpectedSignature(mediaType, input.content)) {
      throw new AppError(415, "ATTACHMENT_TYPE_MISMATCH", "The filename, media type, and file content do not match.");
    }
    const storageKey = `${input.complaintId}/${randomUUID()}`;
    const path = this.resolveStorageKey(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.content, { flag: "wx" });
    return {
      storageKey,
      checksumSha256: createHash("sha256").update(input.content).digest("hex"),
      sizeBytes: input.content.length
    };
  }

  read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveStorageKey(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolveStorageKey(storageKey), { force: true });
  }

  private resolveStorageKey(storageKey: string): string {
    const path = resolve(this.root, storageKey);
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) {
      throw new AppError(500, "INVALID_STORAGE_KEY", "Stored attachment metadata is invalid.");
    }
    return path;
  }
}
