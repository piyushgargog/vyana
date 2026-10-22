// packages/shared/src/health/blood-request.ts
// The message a patient sends from a RapidBlood request (issue #235): plain text for WhatsApp or
// SMS, one fact per line, so a blood bank or a family group can act on it as it is.
// Owner: Vaibhav Parmar

import { cleanInlineText } from "../text/clean";

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
  /** Omit when the patient has not entered a valid count — the message never invents one. */
  units?: number;
  hospital_name: string;
  city: string;
  contact_name: string;
  contact_phone: string;
}


/**
 * Builds the request message from what the patient typed. It says only what the request itself
 * holds: no claim about stock, matching or timing, because the app does not know any of that —
 * the blood bank confirms on the call. The hospital line keeps the city the search was for.
 */
export function buildBloodRequestMessage(input: BloodRequestMessageInput): string {
  const component = COMPONENT_WORDS[input.component] ?? cleanInlineText(input.component.replace(/_/g, " "), 40);
  const units =
    input.units !== undefined && Number.isInteger(input.units) && input.units >= 1
      ? `, ${input.units} ${input.units === 1 ? "unit" : "units"}`
      : "";
  const hospital = cleanInlineText(input.hospital_name, 80);
  const city = cleanInlineText(input.city, 60);
  const contact = cleanInlineText(input.contact_name, 50);
  const phone = cleanInlineText(input.contact_phone, 30);
  return [
    "Blood needed",
    `Group: ${cleanInlineText(input.blood_group, 10)}`,
    `Component: ${component}${units}`,
    `Hospital: ${city ? `${hospital}, ${city}` : hospital}`,
    `Contact: ${phone ? `${contact} ${phone}` : contact}`,
  ].join("\n");
}
