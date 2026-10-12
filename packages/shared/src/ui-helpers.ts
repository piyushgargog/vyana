import { DEFAULT_TIMES, type FrequencyType } from "./constants";
import { CarePlan } from "./contracts";
import type { DbPrescriptionItem } from "./db/types";
import { carePlanMock } from "./mocks/care-plan";

export function parseCarePlanJson(
  planJson: unknown,
  useMocks: boolean = false
): CarePlan | null {
  const parsed = CarePlan.safeParse(planJson);
  if (parsed.success) {
    return parsed.data;
  }
  if (useMocks && (planJson === null || planJson === undefined)) {
    return carePlanMock.plan;
  }
  return null;
}

export function computeItemRefill(
  item: Pick<
    DbPrescriptionItem,
    | "frequency"
    | "times"
    | "quantity_total"
    | "start_date"
    | "end_date"
    | "refill_alert_days"
  >,
  now: Date = new Date()
): {
  dosesPerDay: number;
  daysLeft: number | null;
  refillDate: string | null;
  needsRefillSoon: boolean;
} {
  const times =
    item.times && item.times.length > 0
      ? item.times
      : DEFAULT_TIMES[(item.frequency as FrequencyType) ?? "OD"] ?? [];
  const dosesPerDay = times.length;
  if (
    dosesPerDay === 0 ||
    !item.quantity_total ||
    item.quantity_total <= 0 ||
    !item.start_date
  ) {
    return {
      dosesPerDay,
      daysLeft: null,
      refillDate: null,
      needsRefillSoon: false,
    };
  }
  const totalDays = Math.floor(item.quantity_total / dosesPerDay);
  const start = new Date(`${item.start_date}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.max(
    0,
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const refillDt = new Date(start);
  refillDt.setDate(refillDt.getDate() + totalDays);
  const alertWindow = item.refill_alert_days ?? 5;
  return {
    dosesPerDay,
    daysLeft,
    refillDate: refillDt.toISOString().slice(0, 10),
    needsRefillSoon: daysLeft <= alertWindow,
  };
}

export function generateQrMatrix(text: string, size: number = 25): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (r0 + r < size && c0 + c < size) {
          matrix[r0 + r][c0 + c] = isBorder || isInner;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;
      if (r === 6 || c === 6) {
        matrix[r][c] = (r + c) % 2 === 0;
        continue;
      }
      const charCode = text.charCodeAt(
        (r * size + c) % Math.max(1, text.length)
      );
      const mix =
        ((hash >>> ((r + c) % 16)) ^ (charCode * (r + 3) * (c + 7))) & 3;
      matrix[r][c] = mix === 0 || mix === 2;
    }
  }

  return matrix;
}
