// packages/shared/src/health/blood-request.ts
// The message a patient sends from a RapidBlood request (issue #235): plain text for WhatsApp or
// SMS, one fact per line, so a blood bank or a family group can act on it as it is.
// Owner: Vaibhav Parmar

/** The components of the v1.1 contracts (#233) as a person writes them. */
const COMPONENT_WORDS: Record<string, string> = {
  whole_blood: "whole blood",
  red_cells: "red cells",
  platelets: "platelets",
  plasma: "plasma",
};

export interface BloodRequestMessageInput {
  blood_group: string;
  component: string;
  units: number;
  hospital_name: string;
  city: string;
  contact_name: string;
  contact_phone: string;
}

const clean = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Builds the request message from what the patient typed. It says only what the request itself
 * holds: no claim about stock, matching or timing, because the app does not know any of that —
 * the blood bank confirms on the call. The hospital line keeps the city the search was for.
 */
export function buildBloodRequestMessage(input: BloodRequestMessageInput): string {
  const component = COMPONENT_WORDS[input.component] ?? clean(input.component.replace(/_/g, " "), 40);
  const units = `${input.units} ${input.units === 1 ? "unit" : "units"}`;
  const hospital = clean(input.hospital_name, 80);
  const city = clean(input.city, 60);
  const contact = clean(input.contact_name, 50);
  const phone = clean(input.contact_phone, 30);
  return [
    "Blood needed",
    `Group: ${clean(input.blood_group, 10)}`,
    `Component: ${component}, ${units}`,
    `Hospital: ${city ? `${hospital}, ${city}` : hospital}`,
    `Contact: ${phone ? `${contact} ${phone}` : contact}`,
  ].join("\n");
}
