import { describe, expect, it } from "vitest";

describe("OPD Appointment Booking Logic", () => {
  it("translates database errors into calm plain-language refusal messages", () => {
    function translateBookingError(errMessage: string): string {
      const raw = errMessage.toLowerCase();
      if (raw.includes("you already have a token")) {
        return "You already have an active OPD token for this department on this date. Please check your dashboard.";
      }
      if (raw.includes("opd is closed")) {
        return "The OPD is closed for this department on the selected date. Please choose another date.";
      }
      if (raw.includes("no tokens left")) {
        return "All available tokens have been issued for this department on that day. Please choose another date.";
      }
      if (raw.includes("date is in the past")) {
        return "Appointment date cannot be in the past.";
      }
      return errMessage;
    }

    expect(
      translateBookingError("you already have a token for this department on that day")
    ).toBe(
      "You already have an active OPD token for this department on this date. Please check your dashboard."
    );

    expect(
      translateBookingError("OPD is closed on that day")
    ).toBe(
      "The OPD is closed for this department on the selected date. Please choose another date."
    );

    expect(
      translateBookingError("no tokens left for that day")
    ).toBe(
      "All available tokens have been issued for this department on that day. Please choose another date."
    );

    expect(
      translateBookingError("date is in the past")
    ).toBe("Appointment date cannot be in the past.");
  });

  it("auto-matches department from symptom triage query parameter case-insensitively", () => {
    const departments = [
      { id: "dept-1", name: "General Medicine" },
      { id: "dept-2", name: "Cardiology" },
      { id: "dept-3", name: "Pediatrics" },
    ];

    function matchDepartment(initialParam: string | null, list: typeof departments) {
      if (!initialParam || list.length === 0) return "";
      const match = list.find((d) => d.name.toLowerCase() === initialParam.toLowerCase());
      return match?.id || "";
    }

    expect(matchDepartment("cardiology", departments)).toBe("dept-2");
    expect(matchDepartment("Cardiology", departments)).toBe("dept-2");
    expect(matchDepartment("GENERAL MEDICINE", departments)).toBe("dept-1");
    expect(matchDepartment("Neurology", departments)).toBe("");
    expect(matchDepartment(null, departments)).toBe("");
  });

  it("evaluates booking eligibility and token availability correctly", () => {
    function canBookAppointment({
      hospitalId,
      departmentId,
      date,
      today,
      tokensData,
    }: {
      hospitalId: string;
      departmentId: string;
      date: string;
      today: string;
      tokensData: { opd_open: boolean; tokens_left: number } | null;
    }): boolean {
      if (!hospitalId || !departmentId || !date) return false;
      if (date < today) return false;
      if (tokensData && !tokensData.opd_open) return false;
      if (tokensData && tokensData.tokens_left <= 0) return false;
      return true;
    }

    const today = "2026-10-15";

    // Valid booking
    expect(
      canBookAppointment({
        hospitalId: "h-1",
        departmentId: "d-1",
        date: "2026-10-15",
        today,
        tokensData: { opd_open: true, tokens_left: 45 },
      })
    ).toBe(true);

    // In past date
    expect(
      canBookAppointment({
        hospitalId: "h-1",
        departmentId: "d-1",
        date: "2026-10-14",
        today,
        tokensData: { opd_open: true, tokens_left: 45 },
      })
    ).toBe(false);

    // OPD closed
    expect(
      canBookAppointment({
        hospitalId: "h-1",
        departmentId: "d-1",
        date: "2026-10-18",
        today,
        tokensData: { opd_open: false, tokens_left: 0 },
      })
    ).toBe(false);

    // Tokens exhausted (0 left)
    expect(
      canBookAppointment({
        hospitalId: "h-1",
        departmentId: "d-1",
        date: "2026-10-15",
        today,
        tokensData: { opd_open: true, tokens_left: 0 },
      })
    ).toBe(false);

    // Missing department
    expect(
      canBookAppointment({
        hospitalId: "h-1",
        departmentId: "",
        date: "2026-10-15",
        today,
        tokensData: { opd_open: true, tokens_left: 10 },
      })
    ).toBe(false);
  });
});
