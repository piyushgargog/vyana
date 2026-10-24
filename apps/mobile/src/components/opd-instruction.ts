/**
 * The instruction line on an OPD token card (issue #489). The card used to tell
 * every patient to "report by 8:30 AM" — including for tokens the hospital never
 * confirmed and visits already over. The reporting time is only a promise the app
 * can make for a confirmed token dated today or later; every other token states
 * its status in words instead.
 */
export interface OpdTokenFacts {
  status: string;
  /** `YYYY-MM-DD` */
  appointment_date: string;
  token_no: number;
}

export function opdInstruction(appt: OpdTokenFacts, today: string): string {
  if (appt.status === 'confirmed') {
    return appt.appointment_date >= today
      ? `Report to the OPD registration desk by 8:30 AM with Token #${appt.token_no}.`
      : 'This visit date has passed. Book a new token if you still need to be seen.';
  }
  switch (appt.status) {
    case 'requested':
      return 'Requested — the hospital has not confirmed this token yet.';
    case 'completed':
      return 'This visit is complete.';
    case 'cancelled':
      return 'This token was cancelled.';
    default:
      return `Status: ${appt.status}.`;
  }
}
