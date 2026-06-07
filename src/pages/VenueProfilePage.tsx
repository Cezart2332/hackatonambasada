import { Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldBlock } from "@/components/FormBlocks";
import { LogoutSection } from "@/components/LogoutSection";
import type { Profile, VenueType } from "@/lib/types";

const venueTypeOptions: Array<{ value: VenueType; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "hotel", label: "Hotel" },
  { value: "cafe", label: "Cafenea" },
  { value: "shop", label: "Magazin / băcănie" },
  { value: "deli", label: "Delicatese" },
];

export function VenueProfilePage({
  profile,
  activeMatchCount,
  sessionNeeds,
  sessionFrequency,
  sessionPreferredDays,
  saving,
  saved,
  saveError,
  onSave,
  onLogout,
  onProfileFieldChange,
}: {
  profile: Profile;
  activeMatchCount: number;
  sessionNeeds?: string;
  sessionFrequency?: string;
  sessionPreferredDays?: string;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  onSave: () => void;
  onLogout: () => void;
  onProfileFieldChange: (
    key: "businessName" | "phone" | "location" | "venueType",
    value: string,
  ) => void;
}) {
  const hasSessionNeeds = Boolean(
    sessionNeeds?.trim() || sessionFrequency?.trim() || sessionPreferredDays?.trim(),
  );

  return (
    <ScrollArea className="min-h-0 flex-1 bg-[#f7f3e8]">
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="olive" className="mb-3">
              Profil local
            </Badge>
            <h1 className="text-2xl font-extrabold text-[#263421]">Profilul localului</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Actualizează datele de contact și locația. Ce produse cauți le spui în Asistent.
            </p>
          </div>
          <Badge variant="warm">{activeMatchCount} producători potriviți</Badge>
        </div>

        <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
          <p className="text-sm font-bold text-[#263421]">Date local</p>
          <div className="mt-4 space-y-3">
            <FieldBlock label="Nume local">
              <Input
                value={profile.businessName || ""}
                onChange={(event) => onProfileFieldChange("businessName", event.target.value)}
                placeholder="Ex: Casa Dobrogeană"
              />
            </FieldBlock>
            <FieldBlock label="Tip local">
              <select
                value={profile.venueType || "restaurant"}
                onChange={(event) => onProfileFieldChange("venueType", event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-white/90 px-3 py-2 text-sm"
              >
                {venueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldBlock>
            <FieldBlock label="Telefon contact">
              <Input
                value={profile.phone || ""}
                onChange={(event) => onProfileFieldChange("phone", event.target.value)}
                placeholder="Ex: 07xx xxx xxx"
              />
            </FieldBlock>
            <FieldBlock label="Localitate">
              <Input
                value={profile.location || ""}
                onChange={(event) => onProfileFieldChange("location", event.target.value)}
                placeholder="Ex: Constanța"
              />
            </FieldBlock>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="honey" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Se salvează..." : "Salvează"}
            </Button>
            {saved ? (
              <span className="text-sm font-medium text-[#405235]">Salvat.</span>
            ) : null}
            {saveError ? <span className="text-sm font-medium text-[#884636]">{saveError}</span> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[#c8d9aa] bg-[#f0f5e8] p-4">
          <p className="text-sm font-bold text-[#263421]">Cerere curentă (din Asistent)</p>
          {hasSessionNeeds ? (
            <dl className="mt-3 space-y-2 text-sm">
              {sessionNeeds?.trim() ? (
                <div>
                  <dt className="font-semibold text-[#3f532c]">Produse</dt>
                  <dd className="text-[#5a654f]">{sessionNeeds}</dd>
                </div>
              ) : null}
              {sessionFrequency?.trim() ? (
                <div>
                  <dt className="font-semibold text-[#3f532c]">Cantitate / frecvență</dt>
                  <dd className="text-[#5a654f]">{sessionFrequency}</dd>
                </div>
              ) : null}
              {sessionPreferredDays?.trim() ? (
                <div>
                  <dt className="font-semibold text-[#3f532c]">Zile preferate</dt>
                  <dd className="text-[#5a654f]">{sessionPreferredDays}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[#5a654f]">
              Nu ai o cerere activă în sesiune. Spune în Asistent ce produse cauți și recomandările se actualizează.
            </p>
          )}
        </div>

        <LogoutSection onLogout={onLogout} />
      </div>
    </ScrollArea>
  );
}

export default VenueProfilePage;
