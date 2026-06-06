import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SimulatedCampaignStep } from "@/lib/types";

type CampaignSimPanelProps = {
  open: boolean;
  loading: boolean;
  disclaimer: string;
  steps: SimulatedCampaignStep[];
  onClose: () => void;
};

export function CampaignSimPanel({
  open,
  loading,
  disclaimer,
  steps,
  onClose,
}: CampaignSimPanelProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden border-[#d9d0b8] bg-[#fffdf7]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#3f532c]">
            <Sparkles className="h-5 w-5 text-amber-600" />
            Simulare campanie
          </DialogTitle>
          <DialogDescription asChild>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{disclaimer || "SIMULARE — niciun mesaj nu a fost trimis."}</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[#526b36]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Agentul simulează mesaje și răspunsuri...
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <article
                  key={`${step.leadId}-${index}`}
                  className="rounded-xl border border-[#ded5bf] bg-white/80 p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[#3f532c]">{step.leadName}</h3>
                    <Badge variant="outline" className="border-[#c8d9aa] bg-[#f0f5e8] text-[#3f532c]">
                      {step.simulatedOutcome}
                    </Badge>
                  </div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#8a7a5c]">
                    {step.simulatedAction}
                  </p>
                  <pre className="mb-3 whitespace-pre-wrap rounded-lg bg-[#f7f3e8] p-3 text-sm text-[#4a4030]">
                    {step.draftMessage}
                  </pre>
                  {step.reasoning ? (
                    <p className="text-sm text-muted-foreground">{step.reasoning}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Închide
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
