import { useMemo } from "react";
import type { LeadStatus } from "@/lib/types";

const PIPELINE_STATS: { status: LeadStatus; label: string }[] = [
  { status: "Contactat", label: "Contactat" },
  { status: "A răspuns", label: "Răspuns" },
  { status: "A cumpărat", label: "Cumpărat" },
  { status: "Nu e potrivit", label: "Respinse" },
];

export function DirectorPipelineStats({
  statuses,
}: {
  statuses: Record<string, LeadStatus>;
}) {
  const counts = useMemo(() => {
    const result: Record<LeadStatus, number> = {
      Bun: 0,
      "Nu e potrivit": 0,
      Contactat: 0,
      "A răspuns": 0,
      "A cumpărat": 0,
    };
    for (const status of Object.values(statuses)) {
      result[status] += 1;
    }
    return result;
  }, [statuses]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {PIPELINE_STATS.map(({ status, label }) => (
        <div
          key={status}
          className="min-w-[4.75rem] rounded-xl border border-[#d7e4c4] bg-[#f4f8ee] px-2.5 py-1.5 text-center"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#5a7150]">{label}</p>
          <p className="text-sm font-extrabold tabular-nums text-[#263421]">{counts[status]}</p>
        </div>
      ))}
    </div>
  );
}
