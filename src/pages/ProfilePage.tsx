import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Check,
  Plus,
  MessageCircle,
  Mail,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldBlock, RangeKmInput } from "@/components/FormBlocks";
import { InventoryLineEditor } from "@/components/ProductEditor";
import { LogoutSection } from "@/components/LogoutSection";
import { PlanSection } from "@/components/PlanSection";
import { api } from "@/lib/api";
import type { PlanContext, Profile, ProducerProduct, UnipileIntegrationsStatus } from "@/lib/types";

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

function integrationStatusLabel(status: string, connected: boolean): string {
  if (connected) return "Conectat";
  if (status === "PENDING") return "În curs";
  if (status === "ERROR") return "Eroare";
  return "Neconectat";
}

function UnipileIntegrationsSection() {
  const [integrations, setIntegrations] = useState<UnipileIntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<"whatsapp" | "gmail" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.getUnipileIntegrations();
      setIntegrations(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut încărca integrările.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const handleConnect = async (provider: "whatsapp" | "gmail") => {
    setConnecting(provider);
    setError(null);
    try {
      const { url } = await api.connectUnipile(provider);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => void refresh(), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conectarea a eșuat.");
    } finally {
      setConnecting(null);
    }
  };

  const rows = [
    {
      key: "whatsapp" as const,
      label: "WhatsApp",
      icon: MessageCircle,
      status: integrations?.whatsapp,
    },
    {
      key: "gmail" as const,
      label: "Gmail",
      icon: Mail,
      status: integrations?.gmail,
    },
  ];

  return (
    <div className="rounded-2xl border border-[#d7ccb3] bg-[#fffaf0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#263421]">Mesagerie campanie</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conectează WhatsApp și Gmail ca simularea să trimită mesaje demo din contul tău.
          </p>
        </div>
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6b7d5a]" />
      </div>

      <div className="mt-4 space-y-3">
        {rows.map(({ key, label, icon: Icon, status }) => {
          const connected = Boolean(status?.connected);
          const statusLabel = status ? integrationStatusLabel(status.status, connected) : "—";
          return (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-[#eadfca] bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef3e8] text-[#405235]">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#263421]">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {loading ? "Se verifică..." : statusLabel}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={connected ? "outline" : "honey"}
                size="sm"
                disabled={loading || connecting === key}
                onClick={() => void handleConnect(key)}
              >
                {connecting === key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : connected ? (
                  "Reconectează"
                ) : (
                  `Conectează ${label}`
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Simularea trimite doar către numerele demo 0775313878, 0736671759, 0742557626 și emailurile
        cezarturliu25@gmail.com, cezarturliu245@gmail.com, nicolae.andrei888@gmail.com.
      </p>
      {error ? <p className="mt-2 text-xs font-medium text-[#884636]">{error}</p> : null}
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
  onProfileFieldChange: (key: "businessName" | "phone" | "location" | "range" | "days", value: string) => void;
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
                <FieldBlock label="Gospodărie / Firmă">
                  <Input
                    value={profile.businessName || ""}
                    onChange={(event) => onProfileFieldChange("businessName", event.target.value)}
                    placeholder="Ex: Stupina Ionescu"
                  />
                </FieldBlock>
                <FieldBlock label="Telefon">
                  <Input
                    value={profile.phone || ""}
                    onChange={(event) => onProfileFieldChange("phone", event.target.value)}
                    placeholder="Ex: +40712345678"
                  />
                </FieldBlock>
                <FieldBlock label="Localitate">
                  <Input
                    value={profile.location || ""}
                    onChange={(event) => onProfileFieldChange("location", event.target.value)}
                    placeholder="Ex: Babadag"
                    disabled
                    className="opacity-60 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Localitate setată din căutarea pe hartă (secțiunea Livrare).
                  </p>
                </FieldBlock>
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
                    <RangeKmInput
                      value={profile.range || ""}
                      onChange={(value) => onProfileFieldChange("range", value)}
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

            <UnipileIntegrationsSection />
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
