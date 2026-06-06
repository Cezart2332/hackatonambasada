import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PRODUCT_CATEGORIES,
  composeProductUnit,
  defaultProductFieldsForCategory,
  getBaseUnitLabel,
  getPackagingLabel,
  getPriceUnitShort,
  normalizeLegacyProduct,
  resolveBaseUnitsForProduct,
  type ProductCategoryId,
} from "@/lib/productCatalog";
import {
  defaultAvailableFromDate,
  formatAvailableFromDisplay,
  toDateInputValue,
} from "@/lib/availableFrom";
import type { ProducerProduct } from "@/lib/types";

const selectClassName =
  "flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function createProduct(overrides: Partial<ProducerProduct> = {}): ProducerProduct {
  const categoryDefaults = defaultProductFieldsForCategory("legume_fructe");
  return {
    id: crypto.randomUUID(),
    name: "",
    estimatedQuantity: "",
    pricePerKg: "",
    availableFrom: defaultAvailableFromDate(),
    ...categoryDefaults,
    ...overrides,
    unit:
      overrides.unit ??
      composeProductUnit(
        overrides.category ?? categoryDefaults.category,
        overrides.baseUnit ?? categoryDefaults.baseUnit,
        overrides.packaging ?? categoryDefaults.packaging,
      ),
  };
}

export function patchProducerProduct(
  product: ProducerProduct,
  patch: Partial<ProducerProduct>,
): ProducerProduct {
  const next = { ...product, ...patch };
  const categoryId = (next.category || "legume_fructe") as ProductCategoryId;

  if (patch.category && patch.category !== product.category) {
    const defaults = defaultProductFieldsForCategory(patch.category as ProductCategoryId);
    Object.assign(next, defaults);
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.estimatedQuantity !== undefined) next.estimatedQuantity = patch.estimatedQuantity;
    if (patch.pricePerKg !== undefined) next.pricePerKg = patch.pricePerKg;
    if (patch.availableFrom !== undefined) next.availableFrom = patch.availableFrom;
  }

  if (patch.packaging && patch.packaging !== product.packaging) {
    const allowed = resolveBaseUnitsForProduct(categoryId, next.packaging);
    if (!allowed.includes(next.baseUnit as (typeof allowed)[number])) {
      next.baseUnit = allowed[0];
    }
  }

  next.unit = composeProductUnit(categoryId, next.baseUnit, next.packaging);
  return next;
}

export function ProductEditorCard({
  product,
  index,
  canRemove,
  onUpdate,
  onPatch,
  onRemove,
}: {
  product: ProducerProduct;
  index: number;
  canRemove: boolean;
  onUpdate: (productId: string, key: keyof ProducerProduct, value: string) => void;
  onPatch?: (productId: string, patch: Partial<ProducerProduct>) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <InventoryLineEditor
      product={product}
      index={index}
      canRemove={canRemove}
      onUpdate={onUpdate}
      onPatch={onPatch}
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
  onPatch,
  onRemove,
}: {
  product: ProducerProduct;
  index: number;
  compact?: boolean;
  canRemove: boolean;
  onUpdate: (productId: string, key: keyof ProducerProduct, value: string) => void;
  onPatch?: (productId: string, patch: Partial<ProducerProduct>) => void;
  onRemove: (productId: string) => void;
}) {
  const normalized = normalizeLegacyProduct(product);
  const activeProduct = { ...product, ...normalized };
  const categoryId = activeProduct.category as ProductCategoryId;
  const category = PRODUCT_CATEGORIES.find((item) => item.id === categoryId) ?? PRODUCT_CATEGORIES[1];
  const packagings = category.packagings;
  const baseUnits = resolveBaseUnitsForProduct(categoryId, activeProduct.packaging);

  function applyPatch(patch: Partial<ProducerProduct>) {
    if (onPatch) {
      onPatch(product.id, patch);
      return;
    }
    const next = patchProducerProduct(activeProduct, patch);
    (Object.keys(patch) as Array<keyof ProducerProduct>).forEach((key) => {
      if (next[key] !== activeProduct[key]) {
        onUpdate(product.id, key, String(next[key] ?? ""));
      }
    });
    if (next.unit !== activeProduct.unit) {
      onUpdate(product.id, "unit", next.unit);
    }
  }

  const priceLabel = `Preț / ${getPriceUnitShort(activeProduct.baseUnit)}`;
  const packagingLabel = getPackagingLabel(categoryId, activeProduct.packaging);

  return (
    <div
      className={cn(
        "bg-white/70",
        compact ? "space-y-4 px-4 py-5 first:pt-5 last:pb-5" : "space-y-5 rounded-2xl border border-[#eadfca] p-5 sm:p-6",
      )}
    >
      <div className="flex items-center justify-between gap-4">
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

      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <InlineField label="Categorie principală">
          <select
            value={categoryId}
            onChange={(event) => applyPatch({ category: event.target.value })}
            className={selectClassName}
          >
            {PRODUCT_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </InlineField>
        <InlineField label="Nume produs">
          <Input
            value={activeProduct.name}
            onChange={(event) => onUpdate(product.id, "name", event.target.value)}
            placeholder="Ex: roșii cherry, miere de salcâm"
            className="h-10 rounded-xl"
          />
        </InlineField>
      </div>

      <div className="rounded-xl border border-[#e8e0cf] bg-[#fbf7ed] p-4 sm:p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[#62705a]">
          Cantitate + ambalaj
        </p>
        <div className="grid gap-4 md:grid-cols-[0.8fr_1fr_1fr] md:gap-5">
          <InlineField label="Cantitate estimată">
            <Input
              value={activeProduct.estimatedQuantity}
              onChange={(event) => onUpdate(product.id, "estimatedQuantity", event.target.value)}
              placeholder="40"
              className="h-10 rounded-xl"
            />
          </InlineField>
          <InlineField label="Tip ambalaj / logistică">
            <select
              value={activeProduct.packaging}
              onChange={(event) => applyPatch({ packaging: event.target.value })}
              className={selectClassName}
            >
              {packagings.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </InlineField>
          <InlineField label="Unitate de bază (pentru preț)">
            <select
              value={activeProduct.baseUnit}
              onChange={(event) => applyPatch({ baseUnit: event.target.value })}
              className={selectClassName}
            >
              {baseUnits.map((unitId) => (
                <option key={unitId} value={unitId}>
                  {getBaseUnitLabel(unitId)}
                </option>
              ))}
            </select>
          </InlineField>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:gap-5">
        <InlineField label={priceLabel}>
          <div className="relative">
            <Input
              value={activeProduct.pricePerKg}
              onChange={(event) => onUpdate(product.id, "pricePerKg", event.target.value)}
              placeholder="50"
              className="h-10 rounded-xl pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
              RON
            </span>
          </div>
        </InlineField>
        <InlineField label="Disponibil din">
          <Input
            type="date"
            value={toDateInputValue(activeProduct.availableFrom)}
            onChange={(event) => onUpdate(product.id, "availableFrom", event.target.value)}
            min={defaultAvailableFromDate()}
            className="h-10 rounded-xl [color-scheme:light]"
          />
        </InlineField>
      </div>

      <p className="rounded-xl bg-[#eef2e7] px-4 py-3 text-xs leading-relaxed text-[#526047]">
        <span className="font-semibold text-[#263421]">Previzualizare ofertă:</span>{" "}
        {activeProduct.pricePerKg.trim()
          ? `${activeProduct.pricePerKg.trim()} RON per ${getPriceUnitShort(activeProduct.baseUnit)}`
          : "— RON per unitate"}{" "}
        livrat în <span className="font-medium">{packagingLabel}</span>
        {activeProduct.estimatedQuantity.trim()
          ? ` · cantitate estimată: ${activeProduct.estimatedQuantity.trim()}`
          : ""}
        {formatAvailableFromDisplay(activeProduct.availableFrom)
          ? ` · disponibil din ${formatAvailableFromDisplay(activeProduct.availableFrom)}`
          : ""}
      </p>
    </div>
  );
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
