import React, { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  MessageCircle,
  Store,
  Send,
  Phone,
  Home,
  Plus,
  Leaf,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationSearch } from "@/components/LocationSearch";
import { ProductEditorCard, createProduct, patchProducerProduct } from "@/components/ProductEditor";
import { SectionLabel, FieldBlock, QuickChoiceRow } from "@/components/FormBlocks";
import { normalizeAvailableFrom } from "@/lib/availableFrom";
import type { ProducerSetup, LocationChoice, ProducerProduct } from "@/lib/types";

function StepHint({ icon: Icon, text }: { icon: typeof MessageCircle; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
        <Icon className="h-4 w-4" />
      </span>
      <span>{text}</span>
    </div>
  );
}

export function ProducerOnboardingScreen({
  accountName,
  onBack,
  onComplete,
}: {
  accountName?: string;
  onBack: () => void;
  onComplete: (setup: ProducerSetup) => void;
}) {
  const [setup, setSetup] = useState<ProducerSetup>({
    producerName: accountName || "",
    businessName: "",
    phone: "",
    products: [
      createProduct({
        category: "miere_gemuri",
        name: "Miere de salcâm",
        estimatedQuantity: "40",
        packaging: "borcan_400",
        baseUnit: "piece",
        pricePerKg: "34",
      }),
    ],
    location: "",
    range: "35 km",
    days: "Vineri dimineața",
  });

  const updateSetup = (key: keyof ProducerSetup, value: string) => {
    setSetup((current) => ({ ...current, [key]: value }));
  };

  const updateLocation = (value: string, locationChoice?: LocationChoice) => {
    setSetup((current) => ({ ...current, location: value, locationChoice }));
  };

  const updateProduct = (productId: string, key: keyof ProducerProduct, value: string) => {
    setSetup((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId ? { ...product, [key]: value } : product,
      ),
    }));
  };

  const patchProduct = (productId: string, patch: Partial<ProducerProduct>) => {
    setSetup((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.id === productId ? patchProducerProduct(product, patch) : product,
      ),
    }));
  };

  const addProduct = () => {
    setSetup((current) => ({
      ...current,
      products: [...current.products, createProduct()],
    }));
  };

  const removeProduct = (productId: string) => {
    setSetup((current) => ({
      ...current,
      products:
        current.products.length > 1
          ? current.products.filter((product) => product.id !== productId)
          : current.products,
    }));
  };

  function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanProducts = setup.products.map((product, index) =>
      patchProducerProduct(
        {
          ...product,
          name: product.name.trim() || (index === 0 ? "Miere de salcâm" : "Produs local"),
          estimatedQuantity: product.estimatedQuantity.trim() || "40",
          pricePerKg: product.pricePerKg.trim() || "30",
          availableFrom: normalizeAvailableFrom(product.availableFrom, setup.days),
        },
        {},
      ),
    );

    onComplete({
      ...setup,
      producerName: setup.producerName.trim() || accountName || "Producător local",
      businessName: setup.businessName.trim() || "Gospodărie locală",
      products: cleanProducts,
      location: setup.location.trim() || "Murfatlar",
      range: setup.range.trim() || "35 km",
      days: setup.days.trim() || "Vineri dimineața",
    });
  }

  return (
    <main className="min-h-[100dvh] bg-[#eef2e7] p-4 text-foreground">
      <div className="mx-auto min-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#d9d0b8] bg-[#fbf7ed] shadow-warm">
        <form onSubmit={submitSetup} className="flex min-h-[calc(100dvh-2rem)] flex-col">
          <header className="border-b border-[#ded5bf] px-5 py-5 sm:px-8">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Înapoi
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge variant="olive" className="mb-3">
                  Pasul 2 din 2
                </Badge>
                <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-[#263421] sm:text-4xl">
                  Completează producția pe scurt.
                </h1>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#62705a]">
                  O singură pagină: cine ești, ce ai disponibil, unde livrezi. Poți modifica totul și mai târziu din Profil.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-[#5a654f]">
                <StepHint icon={MessageCircle} text="Chat pregătit" />
                <StepHint icon={Store} text="Lead-uri locale" />
                <StepHint icon={Send} text="Mesaj WhatsApp" />
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-7 px-5 py-5 sm:px-8">
            <section className="space-y-4">
              <SectionLabel eyebrow="1" title="Date de contact" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBlock label="Numele tău">
                  <Input
                    value={setup.producerName}
                    onChange={(event) => updateSetup("producerName", event.target.value)}
                    placeholder="Ex: Ana Popescu"
                  />
                </FieldBlock>
                <FieldBlock label="Telefon WhatsApp">
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={setup.phone}
                      onChange={(event) => updateSetup("phone", event.target.value)}
                      className="pl-11"
                      placeholder="Ex: 07xx xxx xxx"
                    />
                  </div>
                </FieldBlock>
              </div>

              <FieldBlock label="Numele fermei sau gospodăriei">
                <div className="relative">
                  <Home className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={setup.businessName}
                    onChange={(event) => updateSetup("businessName", event.target.value)}
                    className="pl-11"
                    placeholder="Ex: Stupina de la Murfatlar"
                  />
                </div>
              </FieldBlock>
            </section>

            <section className="space-y-3">
              <SectionLabel eyebrow="2" title="Produse disponibile" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Adaugă doar ce vrei să vinzi acum. Mai poți schimba sau șterge produse din Profil.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addProduct}>
                  <Plus className="h-4 w-4" />
                  Adaugă produs
                </Button>
              </div>

              <QuickChoiceRow
                choices={["Miere de salcâm", "Brânză de capră", "Vin dobrogean", "Roșii și verdețuri"]}
                onChoose={(choice) => {
                  const firstProduct = setup.products[0];
                  if (firstProduct) {
                    updateProduct(firstProduct.id, "name", choice);
                  }
                }}
              />

              <div className="space-y-5">
                {setup.products.map((product, index) => (
                  <ProductEditorCard
                    key={product.id}
                    product={product}
                    index={index}
                    canRemove={setup.products.length > 1}
                    onUpdate={updateProduct}
                    onPatch={patchProduct}
                    onRemove={removeProduct}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <SectionLabel eyebrow="3" title="Livrare" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldBlock label="Localitate">
                  <LocationSearch
                    value={setup.location}
                    selectedLocation={setup.locationChoice}
                    onChange={updateLocation}
                  />
                  <QuickChoiceRow
                    choices={["Murfatlar", "Babadag", "Adamclisi", "Năvodari"]}
                    onChoose={(choice) => updateLocation(choice)}
                  />
                </FieldBlock>
                <FieldBlock label="Aria maximă de livrare">
                  <Input
                    value={setup.range}
                    onChange={(event) => updateSetup("range", event.target.value)}
                    placeholder="Ex: 35 km"
                  />
                  <QuickChoiceRow
                    choices={["20 km", "35 km", "60 km", "Pe tot litoralul"]}
                    onChoose={(choice) => updateSetup("range", choice)}
                  />
                </FieldBlock>
              </div>

              <FieldBlock label="Zile bune de livrare">
                <Input
                  value={setup.days}
                  onChange={(event) => updateSetup("days", event.target.value)}
                  placeholder="Ex: marți și vineri dimineața"
                />
                <QuickChoiceRow
                  choices={["Marți dimineața", "Joi după-amiază", "Vineri dimineața", "Weekend"]}
                  onChoose={(choice) => updateSetup("days", choice)}
                />
              </FieldBlock>
            </section>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-[#ded5bf] bg-[#fffaf0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-[#5a654f]">
              Agentul folosește aceste date ca să aleagă lead-uri și să scrie mesajul potrivit.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={onBack}>
                Anulează
              </Button>
              <Button type="submit" variant="honey">
                <Leaf className="h-4 w-4" />
                Continuă spre chat
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </main>
  );
}
export default ProducerOnboardingScreen;
