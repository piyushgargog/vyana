"use client";

// packages/shared/src/hooks/db/aiRuns.ts
// Owner: Vaibhav Parmar

import { useMutation } from "@tanstack/react-query";

import { reportAiMistake } from "../../db/queries/aiRuns";
import type { DbError } from "../../db/queries/helpers";
import type { DbAiRun } from "../../db/types";
import { useDb } from "./shared";

/** "Report a mistake" under an AI answer (plan 2A). The optional `note` (up to 1000 characters) is stored with the report. */
export function useReportAiMistake() {
  const { sb } = useDb();
  return useMutation<DbAiRun, DbError, { ai_run_id: string; note?: string }>({
    mutationFn: ({ ai_run_id, note }) => reportAiMistake(sb, ai_run_id, note),
  });
}
