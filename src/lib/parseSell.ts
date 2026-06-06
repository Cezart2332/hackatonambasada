export type ParsedOfferItem = {
  name: string;
  quantity: string;
  price: string;
};

export function parseSellString(sell: string): ParsedOfferItem[] {
  const trimmed = sell.trim();
  if (!trimmed) return [];

  return trimmed
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s*\((.+?),\s*(.+)\)$/);
      if (!match) {
        return { name: part, quantity: "", price: "" };
      }
      return {
        name: match[1].trim(),
        quantity: match[2].trim(),
        price: match[3].trim(),
      };
    });
}

export function isStructuredSell(sell: string): boolean {
  return parseSellString(sell).some((item) => item.quantity || item.price);
}
