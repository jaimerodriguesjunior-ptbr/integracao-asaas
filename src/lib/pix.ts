import { toDataURL } from "qrcode";

export type PixSettings = {
  pix_key: string;
  merchant_name: string;
  merchant_city: string;
  description: string | null;
  txid_prefix: string | null;
  active: boolean;
};

function onlyAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limit(value: string, maxLength: number) {
  return onlyAscii(value).slice(0, maxLength);
}

function normalizePixKey(value: string) {
  const trimmed = value.trim();

  if (trimmed.includes("@")) return trimmed;
  if (trimmed.length > 30 && trimmed.includes("-")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits}`;
  }

  if (/^\d{2}9\d{8}$/.test(digits) || /^\d{2}[2-5]\d{7}$/.test(digits)) {
    return `+55${digits}`;
  }

  return trimmed.replace(/[^a-zA-Z0-9]/g, "");
}

function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildTxid(settings: PixSettings, storeId: string) {
  const prefix = limit(settings.txid_prefix || "MENSAL", 10).replace(/[^A-Z0-9]/gi, "");
  const suffix = limit(storeId, 14).replace(/[^A-Z0-9]/gi, "");
  return limit(`${prefix}${suffix}`, 25) || "***";
}

export function buildPixCopyPaste(params: {
  settings: PixSettings;
  amount: number;
  storeId: string;
}) {
  const amount = Number(params.amount || 0);

  if (!params.settings.active || amount <= 0) {
    return null;
  }

  const merchantAccountInfo = [
    emv("00", "BR.GOV.BCB.PIX"),
    emv("01", normalizePixKey(params.settings.pix_key).slice(0, 77))
  ].join("");

  const additionalData = emv("05", buildTxid(params.settings, params.storeId));
  const payloadWithoutCrc = [
    emv("00", "01"),
    emv("26", merchantAccountInfo),
    emv("52", "0000"),
    emv("53", "986"),
    emv("54", amount.toFixed(2)),
    emv("58", "BR"),
    emv("59", limit(params.settings.merchant_name, 25).toUpperCase()),
    emv("60", limit(params.settings.merchant_city, 15).toUpperCase()),
    emv("62", additionalData)
  ].join("");

  const payloadWithCrcPrefix = `${payloadWithoutCrc}6304`;
  return `${payloadWithCrcPrefix}${crc16Ccitt(payloadWithCrcPrefix)}`;
}

export async function buildPixQrCodeDataUrl(copyPaste: string | null) {
  if (!copyPaste) {
    return null;
  }

  return toDataURL(copyPaste, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 6,
    type: "image/png"
  });
}
