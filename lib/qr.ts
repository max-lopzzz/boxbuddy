import crypto from "node:crypto";
import QRCode from "qrcode";

const CODE_PREFIX = "bb_";
const CODE_LENGTH = 8;
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"; // no ambiguous chars (0/1/o/l excluded)

export function generateCandidateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export async function generateUniqueCode(
  codeExists: (code: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCandidateCode();
    if (!(await codeExists(candidate))) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique QR code after 10 attempts");
}

export async function renderQrSvg(code: string): Promise<string> {
  return QRCode.toString(code, { type: "svg", margin: 1 });
}
