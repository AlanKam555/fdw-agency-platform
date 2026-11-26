import { prisma } from "@/lib/db";
import { brand, type Personnel } from "@/config/brand";

function personnel(value: unknown): Personnel[] | null {
  if (!Array.isArray(value)) return null;
  const people = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const registrationNo = typeof record.registrationNo === "string" ? record.registrationNo.trim() : "";
    if (!name || !registrationNo) return [];
    return [{ name, registrationNo }];
  });
  return people.length ? people : null;
}

export async function agencyProfile() {
  const row = await prisma.agencySetting.findUnique({ where: { id: "default" } }).catch(() => null);
  return {
    name: brand.name,
    eaLicenceNo: row?.eaLicenceNo?.trim() || brand.licenceNo,
    personnel: personnel(row?.personnel) ?? brand.personnel,
    brandVoice: row?.brandVoice?.trim() || brand.voice,
    voiceNotes: row?.voiceNotes ?? "",
  };
}
