export type ProducerProductLike = {
  name: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const DAIRY_NEED = /lapte|lactate|iaurt|branz|brânz|smantana|smântân|kefir|dairy/;
const DAIRY_PRODUCT = /lapte|lactate|iaurt|branz|brânz|smantana|smântân|vac[aă]|capr[aă]|ov[aă]|brânzetur/;

export function productMatchesNeed(needPart: string, productName: string): boolean {
  const need = normalizeText(needPart);
  const name = normalizeText(productName);
  if (!need.trim() || !name.trim()) return false;
  if (need.includes(name) || name.includes(need)) return true;
  const needWords = need.split(/\s+/).filter((word) => word.length > 3);
  const nameWords = name.split(/\s+/).filter((word) => word.length > 3);
  if (nameWords.some((word) => needWords.some((needWord) => needWord.includes(word) || word.includes(needWord)))) {
    return true;
  }
  if (name.includes("miere") && /miere|borcan|dulce|meli|apicultur/.test(need)) return true;
  if (DAIRY_NEED.test(need) && DAIRY_PRODUCT.test(name)) return true;
  if (/branza|brânz/.test(name) && /branza|brânz|lactate|platou|brânzetur/.test(need)) return true;
  if (/vin/.test(name) && /vin|bautur|băutur/.test(need)) return true;
  if (/legum|rosii|roșii|fruct|rosie/.test(name) && /legum|fruct|verde|rosii|roșii/.test(need)) return true;
  if (/ou|oua|ouă/.test(name) && /ou|oua|ouă/.test(need)) return true;
  if (/carne|porc|vit|berb|miel/.test(name) && /carne|porc|vit|berb|miel/.test(need)) return true;
  return false;
}

export function hasRelevantProductMatch(
  productsNeeded: string,
  products: ProducerProductLike[],
): boolean {
  const need = normalizeText(productsNeeded);
  if (!need.trim()) return true;
  for (const product of products) {
    if (productMatchesNeed(productsNeeded, product.name)) return true;
  }
  return false;
}

export function collectMatchedNeeds(
  productsNeeded: string,
  products: ProducerProductLike[],
): string[] {
  const parts = productsNeeded
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const matched: string[] = [];
  for (const part of parts.length ? parts : [productsNeeded.trim()]) {
    if (!part) continue;
    for (const product of products) {
      if (productMatchesNeed(part, product.name) && !matched.includes(part)) {
        matched.push(part);
        break;
      }
    }
  }
  return matched;
}

export function keywordBoost(productsNeeded: string, products: ProducerProductLike[]): number {
  if (!hasRelevantProductMatch(productsNeeded, products)) return 0;
  const need = normalizeText(productsNeeded);
  if (!need.trim()) return 0;
  let boost = 0;
  for (const product of products) {
    const name = normalizeText(product.name);
    if (!name.trim()) continue;
    if (need.includes(name) || name.split(/\s+/).some((word) => word.length > 3 && need.includes(word))) {
      boost += 10;
      continue;
    }
    if (name.includes("miere") && /miere|borcan|dulce/.test(need)) boost += 8;
    if (DAIRY_NEED.test(need) && DAIRY_PRODUCT.test(name)) boost += 8;
    if (/branza|brânz/.test(name) && /branza|brânz|lactate|platou/.test(need)) boost += 8;
    if (/vin/.test(name) && /vin|bautur|băutur/.test(need)) boost += 6;
    if (/legum|rosii|roșii|fruct/.test(name) && /legum|fruct|verde/.test(need)) boost += 6;
  }
  return Math.min(boost, 30);
}

export function splitNeedTokens(productsNeeded: string): string[] {
  return productsNeeded
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function hasActiveSearchIntent(productsNeeded: string): boolean {
  return Boolean(productsNeeded.trim());
}
