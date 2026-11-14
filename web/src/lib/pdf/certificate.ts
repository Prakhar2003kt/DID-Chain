import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Hex32 } from '../crypto/eip712';
export type CertificateFields = {
  institution: string; studentName: string; qualification: string; certId: Hex32;
  issuedAt: number; expiresAt: number;
};
export async function makeCertificate(fields: CertificateFields): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Academic Certificate ${fields.certId}`);
  pdf.setAuthor(fields.institution);
  const page = pdf.addPage([842, 595]);
  const dark = rgb(0.055, 0.11, 0.20), teal = rgb(0.06, 0.54, 0.53), grey = rgb(0.38, 0.43, 0.49);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 543, width: 842, height: 52, color: dark });
  page.drawText('DID-CHAIN  /  ACADEMIC CREDENTIAL', { x: 48, y: 565, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 32, y: 32, width: 778, height: 494, borderWidth: 1.6, borderColor: teal });
  const centered = (s: string, y: number, size: number, f = font, color = dark) => {
    const safe = s.replace(/[^\x20-\x7E]/g, '?');
    const width = f.widthOfTextAtSize(safe, size);
    page.drawText(safe, { x: Math.max(45, (842 - width) / 2), y, size, font: f, color });
  };
  const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 3) + '...' : s;
  centered(trunc(fields.institution, 64), 457, 22, bold);
  centered('CERTIFICATE OF ACADEMIC ACHIEVEMENT', 396, 16, bold, teal);
  centered('This certifies that', 348, 13, font, grey);
  centered(trunc(fields.studentName, 48), 298, 27, bold);
  centered('has been awarded the qualification', 250, 13, font, grey);
  centered(trunc(fields.qualification, 57), 203, 19, bold, teal);
  centered(`Issued: ${new Date(fields.issuedAt * 1000).toISOString().slice(0, 10)}     Expires: ${fields.expiresAt ? new Date(fields.expiresAt * 1000).toISOString().slice(0, 10) : 'No expiry'}`, 130, 11);
  centered(`Certificate ID: ${fields.certId}`, 92, 8, font, grey);
  page.drawText('Verify the ORIGINAL PDF using the DID-Chain employer portal. This PDF is not itself a PAdES signed PDF.', { x: 76, y: 50, size: 8, font, color: grey });
  return pdf.save({ useObjectStreams: false });
}
