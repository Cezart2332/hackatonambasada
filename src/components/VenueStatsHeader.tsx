import type { Lead, LeadStatus } from "@/lib/types";

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-[#5a7150]">{label}</p>
      <p className="font-semibold text-[#263421]">{value}</p>
    </div>
  );
}

export function VenueStatsHeader({
  leads,
  statuses,
}: {
  leads: Lead[];
  statuses: Record<string, LeadStatus>;
}) {
  const active = Object.values(statuses).filter((s) => s !== "Nu e potrivit").length;
  const contacted = Object.values(statuses).filter((s) => s === "Contactat" || s === "A răspuns" || s === "A cumpărat").length;
  const matchSum = leads.reduce((sum, lead) => sum + (lead.match ?? 0), 0);
  const distSum = leads.reduce((sum, lead) => sum + (Number.parseFloat(String(lead.distance).replace(" km", "")) || 0), 0);
  const avgMatch = leads.length ? Math.round(matchSum / leads.length) : 0;
  const avgDist = leads.length ? Math.round(distSum / leads.length) : 0;

  return (
    <div className="grid gap-2 rounded-2xl border border-[#c8d9aa] bg-[#f0f5e8] px-3 py-2 text-xs sm:grid-cols-3 sm:text-sm">
      <StatPill label="Potriviți" value={`${leads.length} producători · ${active} activi`} />
      <StatPill label="Contact" value={`${contacted} contactați / răspuns`} />
      <StatPill label="Calitate" value={`${avgMatch}% · ${avgDist} km mediu`} />
    </div>
  );
}
