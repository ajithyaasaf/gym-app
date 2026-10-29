import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, generateCsv } from "@/lib/csv";
import {
  verifyMagicBytes,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  storageAdapter,
} from "@/lib/storage";

describe("Storage Security, File Validation & Safe CSV Exports (Scenarios 24 & 28)", () => {
  it("Scenario 28: Sanitizes formula injection characters (=, +, -, @, tab, CR)", () => {
    expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeCsvCell("-500")).toBe("'-500");
    expect(sanitizeCsvCell("@malicious")).toBe("'@malicious");
    expect(sanitizeCsvCell("\tcmd")).toBe("'\tcmd");
  });

  it("Scenario 28: Escapes quotes, commas, and handles Unicode with UTF-8 BOM", () => {
    // Escapes quotes and commas
    expect(sanitizeCsvCell('John "The Rock" Doe, Jr.')).toBe('"John ""The Rock"" Doe, Jr."');

    // Generates complete CSV with BOM
    const headers = ["Member Name", "Phone", "Formula Test"];
    const rows = [
      ["अमित शर्मा (Amit Sharma)", "+91 98765 43210", "=1+1"],
      ['Priya "Fit" Patel', "+91 98765 43211", "Normal Value"],
    ];

    const csvOutput = generateCsv(headers, rows);

    // Verify UTF-8 BOM is present at the beginning (\uFEFF)
    expect(csvOutput.startsWith("\uFEFF")).toBe(true);

    // Verify Unicode hindi text is preserved intact
    expect(csvOutput).toContain("अमित शर्मा (Amit Sharma)");

    // Verify formula was neutralized with single quote prefix
    expect(csvOutput).toContain("'=1+1");

    // Verify quotes were escaped
    expect(csvOutput).toContain('"Priya ""Fit"" Patel"');
  });

  it("Scenario 24: Validates file magic bytes against claimed MIME types", () => {
    // Valid JPEG magic bytes: FF D8 FF
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(verifyMagicBytes(validJpeg, "image/jpeg")).toBe(true);

    // Valid PNG magic bytes: 89 50 4E 47
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(verifyMagicBytes(validPng, "image/png")).toBe(true);

    // Valid PDF magic bytes: %PDF
    const validPdf = Buffer.from("%PDF-1.4 sample content");
    expect(verifyMagicBytes(validPdf, "application/pdf")).toBe(true);

    // Executable / malicious file disguised as JPEG
    const fakeJpeg = Buffer.from("MZ\x90\x00\x03\x00\x00\x00"); // DOS executable header
    expect(verifyMagicBytes(fakeJpeg, "image/jpeg")).toBe(false);

    // Random binary data
    const randomGarbage = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    expect(verifyMagicBytes(randomGarbage, "image/png")).toBe(false);
  });

  it("Scenario 24: Enforces allowlisted MIME types and size limit", () => {
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("application/x-msdownload")).toBe(false); // exe blocked!
    expect(ALLOWED_MIME_TYPES.has("application/javascript")).toBe(false); // js blocked!

    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024); // 5 MB
  });

  it("Scenario 24: Storage adapter securely saves, retrieves, and removes files", async () => {
    const testContent = Buffer.from("%PDF-1.4 Test Gym Receipt Content");
    const saveResult = await storageAdapter.saveFile({
      buffer: testContent,
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
    });

    expect(saveResult.storageKey).toBeDefined();
    expect(saveResult.fileSizeBytes).toBe(testContent.length);

    // Read back
    const retrieved = await storageAdapter.getFile(saveResult.storageKey);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.toString()).toBe(testContent.toString());

    // Delete
    await storageAdapter.deleteFile(saveResult.storageKey);
    const afterDelete = await storageAdapter.getFile(saveResult.storageKey);
    expect(afterDelete).toBeNull();
  });
});
