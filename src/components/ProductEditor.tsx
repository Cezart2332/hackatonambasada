import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProducerProduct } from "@/lib/types";

export function createProduct(overrides: Partial<ProducerProduct> = {}): ProducerProduct {
  return {
    id: crypto.randomUUID(),
    name: "",
    estimatedQuantity: "",
    unit: "kg",
    pricePerKg: "",
    availableFrom: "Săptămâna asta",
    ...overrides,
  };
}

export function ProductEditorCard({
  product,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: {
  product: ProducerProduct;
  index: number;
  canRemove: boolean;
  onUpdate: (productId: string, key: keyof ProducerProduct, value: string) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <InventoryLineEditor
      product={product}
      index={index}
      canRemove={canRemove}
      onUpdate={onUpdate}
      onRemove={onRemove}
    />
  );
}

export function InventoryLineEditor({
  product,
  index,
  compact = false,
  canRemove,
  onUpdate,
  onRemove,
}: {
  product: ProducerProduct;
  index: number;
  compact?: boolean;
  canRemove: boolean;
  onUpdate: (productId: string, key: keyof ProducerProduct, value: string) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <div className={cn("bg-white/70 p-3", compact ? "space-y-3" : "rounded-2xl border border-[#eadfca]")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#263421]">Produs {index + 1}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(product.id)}
          disabled={!canRemove}
          aria-label="Șterge produs"
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1.2fr_0.65fr_0.55fr_0.7fr_0.9fr]">
        <InlineField label="Produs">
          <Input
            value={product.name}
            onChange={(event) => onUpdate(product.id, "name", event.target.value)}
            placeholder="Miere"
            className="h-10 rounded-xl"
          />
        </InlineField>
        <InlineField label="Cantitate">
          <Input
            value={product.estimatedQuantity}
            onChange={(event) => onUpdate(product.id, "estimatedQuantity", event.target.value)}
            placeholder="40"
            className="h-10 rounded-xl"
          />
        </InlineField>
        <InlineField label="Unitate">
          <Input
            value={product.unit}
            onChange={(event) => onUpdate(product.id, "unit", event.target.value)}
            placeholder="kg"
            className="h-10 rounded-xl"
          />
        </InlineField>
        <InlineField label="Preț/kg">
          <Input
            value={product.pricePerKg}
            onChange={(event) => onUpdate(product.id, "pricePerKg", event.target.value)}
            placeholder="34"
            className="h-10 rounded-xl"
          />
        </InlineField>
        <InlineField label="Disponibil">
          <Input
            value={product.availableFrom}
            onChange={(event) => onUpdate(product.id, "availableFrom", event.target.value)}
            placeholder="Vineri"
            className="h-10 rounded-xl"
          />
        </InlineField>
      </div>
    </div>
  );
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
