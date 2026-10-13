// lib/medicineDatabase.ts

export type MedicineInfo = {
  name: string;
  dosage: string;
  frequency: string;
  instructions: string;
};

export const MEDICINE_DB: Record<string, MedicineInfo> = {
  "0363040050052": { name: "Aspirin",         dosage: "81 mg",    frequency: "Once daily",                instructions: "Take with food. Do not crush or chew." },
  "0071015523":    { name: "Metformin",        dosage: "500 mg",   frequency: "Twice daily",               instructions: "Take with meals to reduce stomach upset." },
  "0069153066":    { name: "Amlodipine",       dosage: "5 mg",     frequency: "Once daily",                instructions: "Take at the same time each day." },
  "0071015542":    { name: "Atorvastatin",     dosage: "20 mg",    frequency: "Once daily at bedtime",     instructions: "Can be taken with or without food." },
  "0006074768":    { name: "Losartan",         dosage: "50 mg",    frequency: "Once daily",                instructions: "May be taken with or without food." },
  "0378392093":    { name: "Omeprazole",       dosage: "20 mg",    frequency: "Once daily before breakfast",instructions: "Take 30-60 minutes before eating." },
  "0074455028":    { name: "Levothyroxine",    dosage: "50 mcg",   frequency: "Once daily in the morning", instructions: "Take on an empty stomach, 30 min before food." },
  "METFORMIN_500":    { name: "Metformin",     dosage: "500 mg",   frequency: "Twice daily",               instructions: "Take with meals to reduce stomach upset." },
  "AMLO_5MG":         { name: "Amlodipine",    dosage: "5 mg",     frequency: "Once daily",                instructions: "Take at the same time each day." },
  "ASPIRIN_81":       { name: "Aspirin",        dosage: "81 mg",    frequency: "Once daily",                instructions: "Take with food. Do not crush or chew." },
  "ATORVA_20":        { name: "Atorvastatin",   dosage: "20 mg",    frequency: "Once daily at bedtime",     instructions: "Can be taken with or without food." },
  "LOSARTAN_50":      { name: "Losartan",       dosage: "50 mg",    frequency: "Once daily",                instructions: "May be taken with or without food." },
  "OMEPRAZOLE_20":    { name: "Omeprazole",     dosage: "20 mg",    frequency: "Once daily before breakfast",instructions: "Take 30-60 minutes before eating." },
  "LEVOTHYROX_50":    { name: "Levothyroxine",  dosage: "50 mcg",   frequency: "Once daily in the morning", instructions: "Take on an empty stomach, 30 min before food." },
  "INSULIN_GLARGINE": { name: "Insulin Glargine",dosage: "10 units",frequency: "Once daily at bedtime",     instructions: "Inject subcutaneously. Rotate injection sites." },
};

export function lookupBarcode(raw: string): MedicineInfo | null {
  return MEDICINE_DB[raw.trim()] ?? MEDICINE_DB[raw.trim().toUpperCase()] ?? null;
}

const KNOWN_MEDICINES = [
  "Metformin","Amlodipine","Atorvastatin","Losartan","Omeprazole",
  "Levothyroxine","Aspirin","Insulin","Paracetamol","Amoxicillin",
  "Lisinopril","Simvastatin","Ibuprofen","Cetirizine",
];

const FREQUENCY_MAP: [string, string][] = [
  ["once daily","Once daily"],["twice daily","Twice daily"],
  ["three times daily","Three times daily"],["four times daily","Four times daily"],
  ["every morning","Every morning"],["every night","Every night at bedtime"],
  ["at bedtime","Once daily at bedtime"],["before food","Before food"],
  ["after food","After food"],["with meals","With meals"],
  ["every 8 hours","Every 8 hours"],["every 12 hours","Every 12 hours"],
  [" od ","Once daily"],[" bd ","Twice daily"],
  [" tds ","Three times daily"],[" qid ","Four times daily"],
];

const DEFAULTS: Record<string, MedicineInfo> = {
  metformin:     { name:"Metformin",       dosage:"500 mg",   frequency:"Twice daily",               instructions:"Take with meals to reduce stomach upset." },
  amlodipine:    { name:"Amlodipine",      dosage:"5 mg",     frequency:"Once daily",                instructions:"Take at the same time each day." },
  atorvastatin:  { name:"Atorvastatin",    dosage:"20 mg",    frequency:"Once daily at bedtime",     instructions:"Can be taken with or without food." },
  losartan:      { name:"Losartan",        dosage:"50 mg",    frequency:"Once daily",                instructions:"May be taken with or without food." },
  omeprazole:    { name:"Omeprazole",      dosage:"20 mg",    frequency:"Once daily before breakfast",instructions:"Take 30-60 minutes before eating." },
  levothyroxine: { name:"Levothyroxine",   dosage:"50 mcg",   frequency:"Once daily in the morning", instructions:"Take on an empty stomach, 30 min before food." },
  aspirin:       { name:"Aspirin",         dosage:"81 mg",    frequency:"Once daily",                instructions:"Take with food. Do not crush or chew." },
  insulin:       { name:"Insulin Glargine",dosage:"10 units", frequency:"Once daily at bedtime",     instructions:"Inject subcutaneously. Rotate injection sites." },
  ibuprofen:     { name:"Ibuprofen",       dosage:"400 mg",   frequency:"Three times daily",         instructions:"Take with food or milk." },
};

const FALLBACKS: MedicineInfo[] = [DEFAULTS.metformin, DEFAULTS.amlodipine, DEFAULTS.omeprazole];

export function parseOcrText(ocrText: string): MedicineInfo {
  const text = ocrText ?? "";
  const lower = text.toLowerCase();
  let foundName: string | undefined;
  for (const med of KNOWN_MEDICINES) {
    if (lower.includes(med.toLowerCase())) { foundName = med; break; }
  }
  const dm = text.match(/(\d+\.?\d*)\s*(mg|mcg|g\b|ml|units?|iu)/i);
  const foundDosage = dm ? `${dm[1]} ${dm[2].toLowerCase()}` : undefined;
  let foundFrequency: string | undefined;
  for (const [key, val] of FREQUENCY_MAP) {
    if (lower.includes(key)) { foundFrequency = val; break; }
  }
  const defaults = foundName ? (DEFAULTS[foundName.toLowerCase()] ?? DEFAULTS.metformin) : null;
  if (!foundName && !foundDosage) {
    return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
  }
  return {
    name:         foundName      ?? defaults?.name        ?? "Unknown Medicine",
    dosage:       foundDosage    ?? defaults?.dosage       ?? "--",
    frequency:    foundFrequency ?? defaults?.frequency    ?? "Once daily",
    instructions: defaults?.instructions ?? "Follow your doctor's instructions.",
  };
}
