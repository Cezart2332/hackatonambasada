import React from "react";
import {
  Loader2,
  Check,
  Home,
  Phone,
  MapPin,
  Plus,
  Wheat,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldBlock } from "@/components/FormBlocks";
import { InventoryLineEditor } from "@/components/ProductEditor";
import { LogoutSection } from "@/components/LogoutSection";
import { PlanSection } from "@/components/PlanSection";
import type { PlanContext, Profile, ProducerProduct } from "@/lib/types";

function ProfileRow({ label, value, icon: Icon }: { label: string; value?: string; icon: typeof Wheat }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#ded5bf] bg-[#fffaf0] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf0df] text-[#526b36]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-[#263421]">{value || "Încă nu am întrebat"}</p>
      </div>
    </div>
  );
}

function ProfileProducts({
  products,
  onAdd,
  onRemove,
  onUpdate,
  onPatch,
}: {
  products: ProducerProduct[];
  onAdd: () => void;
  onRemove: (productId: string) => void;
  onUpdate: (productId: string, key: keyof ProducerProduct, value: string) => void;
  onPatch: (productId: string, patch: Partial<ProducerProduct>) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#263421]">Produse și prețuri</p>
          <p className="text-xs text-muted-foreground">Editezi direct, fără pași în plus.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Adaugă
        </Button>
      </div>
      <div className="mt-4 divide-y divide-[#eadfca] overflow-hidden rounded-2xl border border-[#eadfca] bg-white/70">
        {products.map((product, index) => (
          <InventoryLineEditor
            key={product.id}
            product={product}
            index={index}
            compact
            canRemove={products.length > 1}
            onRemove={onRemove}
            onUpdate={onUpdate}
            onPatch={onPatch}
          />
        ))}
      </div>
    </div>
  );
}

export function ProfilePage({
  profile,
  activeLeadCount,
  plan,
  planUpgrading,
  saving,
  saved,
  saveError,
  onSave,
  onUpgradePro,
  onDowngradeFree,
  onProductAdd,
  onProductRemove,
  onProductUpdate,
  onProductPatch,
  onLogout,
  onProfileFieldChange,
}: {
  profile: Profile;
  activeLeadCount: number;
  plan: PlanContext | null;
  planUpgrading?: boolean;
  saving: boolean;
  saved: boolean;
  saveError: string | null;
  onSave: () => void;
  onLogout: () => void;
  onUpgradePro: () => void;
  onDowngradeFree?: () => void;
  onProductAdd: () => void;
  onProductRemove: (productId: string) => void;
  onProductUpdate: (productId: string, key: keyof ProducerProduct, value: string) => void;
  onProductPatch: (productId: string, patch: Partial<ProducerProduct>) => void;
  onProfileFieldChange: (key: "location" | "range" | "days", value: string) => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1 bg-[#f7f3e8]">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="olive" className="mb-3">
              Profil
            </Badge>
            <h1 className="text-2xl font-extrabold text-[#263421]">Profilul producătorului</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifici direct produsele, prețurile și livrarea pentru recomandări mai bune.
            </p>
          </div>
          <Badge variant="warm">{activeLeadCount} lead-uri active</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="honey" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Se salvează..." : "Salvează profilul"}
          </Button>
          {saved ? <span className="text-sm font-medium text-[#405235]">Profil salvat cu succes.</span> : null}
          {saveError ? <span className="text-sm font-medium text-[#884636]">{saveError}</span> : null}
        </div>

        <PlanSection
          plan={plan}
          upgrading={planUpgrading}
          onUpgrade={onUpgradePro}
          onDowngrade={onDowngradeFree}
        />

        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
              <p className="text-sm font-bold text-[#263421]">Date producător</p>
              <div className="mt-4 space-y-3">
                <ProfileRow label="Gospodărie" value={profile.businessName} icon={Home} />
                <ProfileRow label="Telefon" value={profile.phone} icon={Phone} />
                <ProfileRow label="Localitate" value={profile.location} icon={MapPin} />
              </div>
            </div>

            <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
              <p className="text-sm font-bold text-[#263421]">Livrare</p>
              <div className="mt-4 space-y-3">
                <FieldBlock label="Localitate">
                  <Input
                    value={profile.location || ""}
                    onChange={(event) => onProfileFieldChange("location", event.target.value)}
                    placeholder="Ex: Babadag"
                  />
                </FieldBlock>
                <div className="grid grid-cols-2 gap-3">
                  <FieldBlock label="Arie maximă">
                    <Input
                      value={profile.range || ""}
                      onChange={(event) => onProfileFieldChange("range", event.target.value)}
                      placeholder="Ex: 35 km"
                    />
                  </FieldBlock>
                  <FieldBlock label="Zile bune">
                    <Input
                      value={profile.days || ""}
                      onChange={(event) => onProfileFieldChange("days", event.target.value)}
                      placeholder="Ex: vineri"
                    />
                  </FieldBlock>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
            <ProfileProducts
              products={profile.products || []}
              onAdd={onProductAdd}
              onRemove={onProductRemove}
              onUpdate={onProductUpdate}
              onPatch={onProductPatch}
            />
          </div>
        </div>

        <LogoutSection onLogout={onLogout} />
      </div>
    </ScrollArea>
  );
}
export default ProfilePage;
