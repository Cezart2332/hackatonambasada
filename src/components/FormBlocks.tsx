import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatRangeKm, parseRangeValue } from "@/lib/api";

export function SectionLabel({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e9f0dc] text-xs font-extrabold text-[#4d6638]">
        {eyebrow}
      </span>
      <h2 className="text-base font-extrabold text-[#263421]">{title}</h2>
    </div>
  );
}

export function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[#33412c]">{label}</span>
      {children}
    </label>
  );
}

export function RangeKmInput({
  value,
  onChange,
  placeholder = "35",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-stretch overflow-hidden rounded-md border border-input bg-white/90",
        className,
      )}
    >
      <Input
        type="number"
        min={1}
        max={500}
        inputMode="numeric"
        value={parseRangeValue(value)}
        onChange={(event) => onChange(formatRangeKm(event.target.value))}
        placeholder={placeholder}
        className="h-full border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <span className="flex shrink-0 items-center border-l border-input bg-[#f5f0e5] px-3 text-sm font-semibold text-[#5a654f]">
        km
      </span>
    </div>
  );
}

export function QuickChoiceRow({ choices, onChoose }: { choices: string[]; onChoose: (choice: string) => void }) {
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {choices.map((choice) => (
        <Button
          key={choice}
          type="button"
          size="sm"
          variant="chip"
          onClick={() => onChoose(choice)}
          className="shrink-0"
        >
          {choice}
        </Button>
      ))}
    </div>
  );
}
