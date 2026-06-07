import { AlertTriangle, Loader2, Mail, MessageCircle, Sparkles } from "lucide-react";
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
import type { Lead, SimulatedCampaignStep } from "@/lib/types";

type CampaignSimPanelProps = {
  open: boolean;
  loading: boolean;
  disclaimer: string;
  steps: SimulatedCampaignStep[];
  onClose: () => void;
  leads?: Lead[];
};

export function CampaignSimPanel({
  open,
  loading,
  disclaimer,
  steps,
  onClose,
  leads,
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

                  {/* Manual outreach buttons */}
                  {(() => {
                    const lead = leads?.find((l) => l.id === step.leadId);
                    const email = lead?.contact && lead.contact.includes("@") ? lead.contact : "";
                    const phone = lead?.phone?.replace(/[+\s-]/g, "") ?? "";
                    
                    if (!phone && !email) return null;
                    
                    return (
                      <div className="mb-3 rounded-xl border border-[#ded5bf]/60 bg-[#fffdfa] p-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a7a5c]">
                          Trimite manual mesajul:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {phone && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 h-8 text-xs rounded-lg shadow-sm"
                              onClick={() => {
                                window.open(
                                  `https://wa.me/${phone}?text=${encodeURIComponent(step.draftMessage)}`,
                                  "_blank"
                                );
                              }}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>
                          )}
                          {email && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 h-8 text-xs rounded-lg shadow-sm"
                              onClick={() => {
                                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                                  email
                                )}&su=${encodeURIComponent("Ofertă produse locale")}&body=${encodeURIComponent(
                                  step.draftMessage
                                )}`;
                                window.open(gmailUrl, "_blank");
                              }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Gmail
                            </Button>
                          )}
                          {email && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#eadfca] text-[#2b3725] hover:bg-[#fff9eb] font-semibold flex items-center gap-1.5 h-8 text-xs rounded-lg shadow-sm"
                              onClick={() => {
                                const mailtoUrl = `mailto:${encodeURIComponent(
                                  email
                                )}?subject=${encodeURIComponent("Ofertă produse locale")}&body=${encodeURIComponent(
                                  step.draftMessage
                                )}`;
                                window.open(mailtoUrl, "_blank");
                              }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Email
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {step.deliveries?.length ? (
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                      {step.deliveries.map((delivery, deliveryIndex) => {
                        const Icon = delivery.channel === "email" ? Mail : MessageCircle;
                        const statusTone =
                          delivery.status === "sent"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : delivery.status === "failed"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-stone-200 bg-stone-50 text-stone-700";
                        return (
                          <div
                            key={`${delivery.channel}-${delivery.target}-${deliveryIndex}`}
                            className="flex min-w-0 items-start gap-2 rounded-lg border border-[#e6ddc8] bg-[#fffaf0] px-3 py-2 text-xs"
                          >
                            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#647a45]" />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="break-all font-medium text-[#4a4030]">
                                  {delivery.target}
                                </span>
                                <Badge variant="outline" className={statusTone}>
                                  {delivery.status}
                                </Badge>
                              </div>
                              {delivery.detail ? (
                                <p className="mt-1 line-clamp-2 text-muted-foreground">{delivery.detail}</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
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
