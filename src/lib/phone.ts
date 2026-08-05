/** Bangladeshi mobile number: 11 digits, starts 01[3-9]. */
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

/**
 * wa.me deep link for a stored phone number. Handles the common local
 * "01XXXXXXXXX" format (prefixes the 880 country code) and passes through
 * anything already in international form.
 */
export function toWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("880") ? digits : digits.startsWith("0") ? `880${digits.slice(1)}` : digits;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${intl}${query}`;
}
