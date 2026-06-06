import { Fragment } from "react";

const STEPS = [
  { label: "Produse", description: "Ce cauți" },
  { label: "Cantitate", description: "Frecvență" },
  { label: "Livrare", description: "Zile preferate" },
] as const;

export function VenueChatProgress() {
  return (
    <div className="mx-auto mb-2.5 w-full max-w-3xl rounded-xl border border-[#ded5bf] bg-[#fffaf0] px-4 py-2.5">
      <div className="flex w-full items-center">
        {STEPS.map((step, index) => (
          <Fragment key={step.label}>
            <div className="flex min-w-0 flex-1 flex-col items-center text-center">
              <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#ece5d4] text-xs font-bold text-[#3f532c]">
                {index + 1}
              </span>
              <p className="text-xs font-semibold text-[#263421]">{step.label}</p>
              <p className="text-[10px] text-muted-foreground">{step.description}</p>
            </div>
            {index < STEPS.length - 1 ? (
              <div className="flex flex-1 items-center self-center px-2 pt-1 sm:px-4">
                <div className="h-px w-full bg-[#c4baa0]" />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
