/**
 * Indian phone number validation and normalization.
 * Accepts various Indian phone number formats and normalizes to standard +91XXXXXXXXXX format.
 */

export function normalizeIndianPhone(input: string): string {
  if (!input) return "";

  // Strip all non-digit characters except leading +
  let cleaned = input.trim().replace(/[^\d+]/g, "");

  // Remove leading +
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // If starts with 91 and has 12 digits, strip 91
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // If starts with 0 and has 11 digits, strip 0
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Validate standard 10-digit mobile number starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    throw new Error(
      `Invalid Indian mobile number: '${input}'. Must be a valid 10-digit number starting with 6, 7, 8, or 9.`
    );
  }

  return `+91${cleaned}`;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "—";
  const norm = phone.replace(/[^\d]/g, "");
  if (norm.length === 12 && norm.startsWith("91")) {
    const raw = norm.slice(2);
    return `+91 ${raw.slice(0, 5)} ${raw.slice(5)}`;
  }
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone;
}

export function buildWhatsAppLink(phone: string, text: string): string {
  const norm = phone.replace(/[^\d]/g, "");
  const destination = norm.startsWith("91") ? norm : `91${norm}`;
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${destination}?text=${encodedText}`;
}

