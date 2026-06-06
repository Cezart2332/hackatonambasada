import {
  Building2,
  Check,
  Coffee,
  Home,
  Loader2,
  MapPin,
  Phone,
  Store,
  Utensils,
  Wine,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldBlock } from "@/components/FormBlocks";
import { LogoutSection } from "@/components/LogoutSection";
import type { Profile, VenueType } from "@/lib/types";

const venueTypeOptions: Array<{ value: VenueType; label: string; icon: typeof Utensils }> = [
  { value: "restaurant", label: "Restaurant", icon: Utensils },
  { value: "hotel", label: "Hotel", icon: Building2 },
  { value: "cafe", label: "Cafenea", icon: Coffee },
  { value: "shop", label: "Magazin / băcănie", icon: Store },
  { value: "deli", label: "Delicatese", icon: Wine },
];

function ProfileRow({ label, value, icon: Icon }: { label: string; value?: string; icon: typeof Home }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf0df] text-[#526b36]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-[#263421]">{value || "Încă nu am completat"}</p>
      </div>
    </div>
  );
}

export function VenueProfilePage({
  profile,
  activeMatchCount,
  saving,
  saved,
  saveError,
  onSave,
  onLogout,
  onProfileFieldChange,
}: {
  profile: Profile;
  activeMatchCount: number;
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
  const venueTypeLabel =
    venueTypeOptions.find((option) => option.value === profile.venueType)?.label || "Local HoReCa";

  return (
    <ScrollArea className="min-h-0 flex-1 bg-[#f7f3e8]">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="olive" className="mb-3">
              Profil local
            </Badge>
            <h1 className="text-2xl font-extrabold text-[#263421]">Profilul localului tău</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Datele localului (nume, locație, contact). Ce produse cauți le spui în Chat — acolo se actualizează recomandările.
            </p>
          </div>
          <Badge variant="warm">{activeMatchCount} producători activi</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="honey" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Se salvează..." : "Salvează profilul"}
          </Button>
          {saved ? (
            <span className="text-sm font-medium text-[#405235]">Profil salvat.</span>
          ) : null}
          {saveError ? <span className="text-sm font-medium text-[#884636]">{saveError}</span> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
            <p className="text-sm font-bold text-[#263421]">Date local</p>
            <div className="mt-4 space-y-3">
              <ProfileRow label="Local" value={profile.businessName} icon={Home} />
              <ProfileRow label="Tip" value={venueTypeLabel} icon={Building2} />
              <ProfileRow label="Telefon" value={profile.phone} icon={Phone} />
              <ProfileRow label="Locație" value={profile.location} icon={MapPin} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
            <p className="text-sm font-bold text-[#263421]">Aprovizionare</p>
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
          </div>
        </div>

        <div className="rounded-2xl border border-[#c8d9aa] bg-[#f0f5e8] p-4">
          <p className="text-sm font-bold text-[#263421]">Produse căutate — doar în Chat</p>
          <p className="mt-1 text-sm text-[#5a654f]">
            Nevoile nu se salvează în profil — le spui în Chat când ai nevoie (ex. „am nevoie de lapte și miere”)
            și recomandările se actualizează pe loc.
          </p>
        </div>

        <LogoutSection onLogout={onLogout} />
      </div>
    </ScrollArea>
  );
}

export default VenueProfilePage;
