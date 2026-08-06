import crypto from "node:crypto";
import bwipjs from "bwip-js/node";

const CODE_PREFIX = "bb_";
const CODE_LENGTH = 8;
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"; // no ambiguous chars (0/1/o/l excluded)

export function generateCandidateSku(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export async function generateUniqueSku(
  skuExists: (sku: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCandidateSku();
    if (!(await skuExists(candidate))) {
      return candidate;
    }
  }
  throw new Error("Could not generate a unique SKU after 10 attempts");
}

export function renderBarcodeSvg(sku: string): string | null {
  try {
    return bwipjs.toSVG({ bcid: "code128", text: sku });
  } catch {
    return null;
  }
}
