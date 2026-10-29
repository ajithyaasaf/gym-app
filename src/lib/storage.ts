import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/**
 * Checks file magic bytes against claimed MIME type.
 */
export function verifyMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (claimedMime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (claimedMime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // WEBP: RIFF....WEBP
  if (claimedMime === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  // PDF: %PDF
  if (claimedMime === "application/pdf") {
    return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  }

  return false;
}

export interface StorageAdapter {
  saveFile(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ storageKey: string; fileSizeBytes: number }>;
  getFile(storageKey: string): Promise<Buffer | null>;
  deleteFile(storageKey: string): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  }

  private async ensureDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // directory exists
    }
  }

  async saveFile(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<{ storageKey: string; fileSizeBytes: number }> {
    await this.ensureDir();
    const ext = path.extname(params.fileName) || ".bin";
    const randomKey = `${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(this.baseDir, randomKey);

    await fs.writeFile(targetPath, params.buffer);
    return {
      storageKey: randomKey,
      fileSizeBytes: params.buffer.length,
    };
  }

  async getFile(storageKey: string): Promise<Buffer | null> {
    const safeKey = path.basename(storageKey);
    const targetPath = path.join(this.baseDir, safeKey);
    try {
      return await fs.readFile(targetPath);
    } catch {
      return null;
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    const safeKey = path.basename(storageKey);
    const targetPath = path.join(this.baseDir, safeKey);
    try {
      await fs.unlink(targetPath);
    } catch {
      // file already absent
    }
  }
}

export const storageAdapter: StorageAdapter = new LocalStorageAdapter();

