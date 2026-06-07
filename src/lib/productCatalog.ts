export type ProductCategoryId =
  | "legume_fructe"
  | "lactate_branzeturi"
  | "carnuri_mezeluri"
  | "miere_gemuri"
  | "peste_bacanie"
  | "vinuri_bauturi"
  | "altele";

export type BaseUnitId = "kg" | "l" | "piece";

export type PackagingOption = {
  id: string;
  label: string;
  baseUnits: BaseUnitId[];
};

export type ProductCategory = {
  id: ProductCategoryId;
  label: string;
  defaultBaseUnit: BaseUnitId;
  packagings: PackagingOption[];
};

const BASE_UNIT_LABELS: Record<BaseUnitId, string> = {
  kg: "Kilogram (kg)",
  l: "Litru (L)",
  piece: "Bucată",
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: "vinuri_bauturi",
    label: "Vinuri și Băuturi",
    defaultBaseUnit: "l",
    packagings: [
      { id: "l_vrac", label: "Litri (vrac)", baseUnits: ["l"] },
      { id: "sticla_750", label: "Sticlă (750ml)", baseUnits: ["piece", "l"] },
      { id: "bib", label: "Bag-in-Box (3L / 5L)", baseUnits: ["l", "piece"] },
      { id: "keg", label: "Butoi / Keg", baseUnits: ["l"] },
    ],
  },
  {
    id: "legume_fructe",
    label: "Legume / Fructe",
    defaultBaseUnit: "kg",
    packagings: [
      { id: "kg_vrac", label: "Kg (vrac)", baseUnits: ["kg"] },
      { id: "lada", label: "Lază / Caserolă", baseUnits: ["kg"] },
      { id: "sac", label: "Sac (25kg / 50kg)", baseUnits: ["kg"] },
      { id: "legatura", label: "Legătură / Snop", baseUnits: ["piece", "kg"] },
    ],
  },
  {
    id: "lactate_branzeturi",
    label: "Lactate / Brânzeturi",
    defaultBaseUnit: "kg",
    packagings: [
      { id: "kg_vrac", label: "Kg (vrac)", baseUnits: ["kg"] },
      { id: "l_vrac", label: "Litri", baseUnits: ["l"] },
      { id: "calup", label: "Calup / Roată", baseUnits: ["kg", "piece"] },
      { id: "galeata_saramura", label: "Găleată (saramură)", baseUnits: ["kg", "l"] },
    ],
  },
  {
    id: "carnuri_mezeluri",
    label: "Carnuri / Mezeluri",
    defaultBaseUnit: "kg",
    packagings: [
      { id: "kg_vrac", label: "Kg (vrac)", baseUnits: ["kg"] },
      { id: "baton", label: "Baton / Pereche", baseUnits: ["piece", "kg"] },
      { id: "pachet_vid", label: "Pachet (vid)", baseUnits: ["kg", "piece"] },
    ],
  },
  {
    id: "miere_gemuri",
    label: "Miere / Gemuri / Conservate",
    defaultBaseUnit: "piece",
    packagings: [
      { id: "borcan_250", label: "Borcan 250ml", baseUnits: ["piece"] },
      { id: "borcan_400", label: "Borcan 400ml", baseUnits: ["piece"] },
      { id: "borcan_800", label: "Borcan 800ml", baseUnits: ["piece"] },
      { id: "galeata_vrac", label: "Găleată (vrac)", baseUnits: ["kg", "l"] },
      { id: "bucata", label: "Bucată", baseUnits: ["piece"] },
    ],
  },
  {
    id: "peste_bacanie",
    label: "Pește și Băcănie Premium",
    defaultBaseUnit: "kg",
    packagings: [
      { id: "caserola", label: "Caserolă", baseUnits: ["kg", "piece"] },
      { id: "pachet_vid", label: "Pachet (vid)", baseUnits: ["kg", "piece"] },
      { id: "ladita_gheata", label: "Lădiță cu gheață", baseUnits: ["kg"] },
    ],
  },
  {
    id: "altele",
    label: "Altele",
    defaultBaseUnit: "kg",
    packagings: [
      { id: "kg_vrac", label: "Kilogram (vrac)", baseUnits: ["kg"] },
      { id: "l_vrac", label: "Litru (vrac)", baseUnits: ["l"] },
      { id: "bucata", label: "Bucată", baseUnits: ["piece"] },
      { id: "lada", label: "Lază / Bax", baseUnits: ["kg", "piece"] },
      { id: "sac", label: "Sac (25kg / 50kg)", baseUnits: ["kg"] },
      { id: "pachet_vid", label: "Pachet (vid)", baseUnits: ["kg", "piece"] },
      { id: "borcan", label: "Borcan / Recipient", baseUnits: ["piece", "l"] },
      { id: "galeata", label: "Găleată", baseUnits: ["kg", "l"] },
      { id: "palet", label: "Palet / Semipalet", baseUnits: ["kg"] },
    ],
  },
];

export function getCategoryConfig(categoryId: string): ProductCategory | undefined {
  return PRODUCT_CATEGORIES.find((category) => category.id === categoryId);
}

export function getPackagingOption(categoryId: string, packagingId: string): PackagingOption | undefined {
  return getCategoryConfig(categoryId)?.packagings.find((option) => option.id === packagingId);
}

export function getBaseUnitLabel(baseUnitId: string): string {
  return BASE_UNIT_LABELS[baseUnitId as BaseUnitId] ?? baseUnitId;
}

export function getPackagingLabel(categoryId: string, packagingId: string): string {
  return getPackagingOption(categoryId, packagingId)?.label ?? packagingId;
}

export function getPriceUnitShort(baseUnitId: string): string {
  if (baseUnitId === "l") return "L";
  if (baseUnitId === "piece") return "buc";
  return "kg";
}

export function composeProductUnit(categoryId: string, baseUnitId: string, packagingId: string): string {
  const packaging = getPackagingLabel(categoryId, packagingId);
  const base = getPriceUnitShort(baseUnitId);
  if (!packagingId) return base;
  return `${base} · ${packaging}`;
}

export function resolveBaseUnitsForProduct(categoryId: string, packagingId: string): BaseUnitId[] {
  const fromPackaging = getPackagingOption(categoryId, packagingId)?.baseUnits;
  if (fromPackaging?.length) return fromPackaging;
  return [getCategoryConfig(categoryId)?.defaultBaseUnit ?? "kg"];
}

export function defaultProductFieldsForCategory(categoryId: ProductCategoryId) {
  const category = getCategoryConfig(categoryId);
  const packaging = category?.packagings[0];
  const baseUnit = packaging?.baseUnits[0] ?? category?.defaultBaseUnit ?? "kg";
  return {
    category: categoryId,
    packaging: packaging?.id ?? "",
    baseUnit,
    unit: composeProductUnit(categoryId, baseUnit, packaging?.id ?? ""),
  };
}

export function inferCategoryFromName(name: string): ProductCategoryId {
  const lower = name.toLowerCase().trim();
  
  if (
    /miere|polen|propolis|fagure|ceara|ceară|stupina|stupină|stupine|albin/i.test(
      lower
    )
  ) {
    return "miere_gemuri";
  }
  if (
    /branz|brânz|lactat|lapte|iaurt|smantan|smântân|unt|cașcaval|cascaval|urdă|urda|capră|capra|oaie|oie|vacă|vaca|caș|cas/i.test(
      lower
    )
  ) {
    return "lactate_branzeturi";
  }
  if (
    /carne|mezel|pui|porc|vită|vita|miel|curcan|cârnaț|carnat|salam|șunc|sunc|pastram|ceaf|organ|mici|carnaț/i.test(
      lower
    )
  ) {
    return "carnuri_mezeluri";
  }
  if (/vin|bere|suc|must|băutur|bautur|palinc|țuic|tuic|lichior|cidru/i.test(lower)) {
    return "vinuri_bauturi";
  }
  if (/peșt|pest|icre|scrumb|păstr|pastr|crap|somon|fructe de mare/i.test(lower)) {
    return "peste_bacanie";
  }
  if (
    /legum|fruct|mere|pere|roși|rosi|castravet|cartof|ceap|usturoi|salat|ardei|cireș|caise|piersic|strugur|prun|cireş|verdeaț|verdeat|mărar|marar|pătrunjel|patrunjel/i.test(
      lower
    )
  ) {
    return "legume_fructe";
  }
  
  return "altele";
}

export function normalizeLegacyProduct(product: {
  name: string;
  category?: string;
  baseUnit?: string;
  packaging?: string;
  unit?: string;
}): { category: ProductCategoryId; baseUnit: BaseUnitId; packaging: string; unit: string } {
  let categoryId = product.category as ProductCategoryId;
  
  if (!categoryId || !getCategoryConfig(categoryId)) {
    categoryId = inferCategoryFromName(product.name);
  }

  const packaging = product.packaging || getCategoryConfig(categoryId)?.packagings[0]?.id || "";
  const baseUnit = (product.baseUnit as BaseUnitId) || getCategoryConfig(categoryId)?.defaultBaseUnit || "kg";
  return {
    category: categoryId,
    baseUnit,
    packaging,
    unit: product.unit || composeProductUnit(categoryId, baseUnit, packaging),
  };
}
