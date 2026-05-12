/**
 * Utility for one-click communication (WhatsApp & Email)
 */

export const stripPhoneNumber = (phone: string) => {
  return phone.replace(/[^0-9]/g, "");
};

export const handleWhatsappClick = (phone: string, text: string) => {
  if (!phone) return;
  const cleanPhone = stripPhoneNumber(phone);
  // If no country code, prepend 91 for India
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = encodeURIComponent(text);
  window.open(`https://wa.me/${formattedPhone}?text=${encodedText}`, "_blank");
};

export const handleEmailClick = (email: string, subject: string, body: string) => {
  if (!email) return;
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  window.location.href = `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
};
