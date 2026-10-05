/** wa.me link with a prefilled message; the user sends it from WhatsApp. */
export function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, "");
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
