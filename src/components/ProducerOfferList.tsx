import { parseSellString } from "@/lib/parseSell";
import { cn } from "@/lib/utils";

function isPendingValue(value: string) {
  return /de confirmat/i.test(value);
}

export function ProducerOfferList({
  sell,
  className,
  compact = false,
}: {
  sell: string;
  className?: string;
  compact?: boolean;
}) {
  const items = parseSellString(sell);

  if (!items.length) return null;

  const structured = items.some((item) => item.quantity || item.price);
  if (!structured) {
    return (
      <p className={cn("text-sm font-semibold leading-relaxed text-[#263421] sm:text-[15px]", className)}>
        {sell}
      </p>
    );
  }

  return (
    <ul className={cn(compact ? "mt-1.5 space-y-1" : "mt-2 space-y-2", className)}>
      {items.map((item, index) => (
        <li
          key={`${item.name}-${index}`}
          className="border-l-2 border-[#c8d9aa] pl-2.5"
        >
          <p className="text-sm font-bold leading-snug text-[#263421] sm:text-[15px]">
            {item.name}
          </p>
          {(item.quantity || item.price) ? (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs sm:text-sm">
              {item.quantity ? (
                <span
                  className={cn(
                    "font-medium",
                    isPendingValue(item.quantity) ? "italic text-[#8a9478]" : "text-[#4a5642]",
                  )}
                >
                  {item.quantity}
                </span>
              ) : null}
              {item.quantity && item.price ? (
                <span className="text-[#c4baa0]" aria-hidden>
                  ·
                </span>
              ) : null}
              {item.price ? (
                <span
                  className={cn(
                    "font-semibold",
                    isPendingValue(item.price) ? "italic text-[#8a9478]" : "text-[#3f532c]",
                  )}
                >
                  {item.price}
                </span>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
