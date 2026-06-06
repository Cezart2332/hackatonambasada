import { Clock3, Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentAvatar } from "@/components/AgentAvatar";
import type { ApprovalStatus } from "@/lib/types";

export function PendingApprovalScreen({
  status,
  accountLabel,
  onRefresh,
  onLogout,
  refreshing,
}: {
  status: ApprovalStatus;
  accountLabel: string;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  refreshing: boolean;
}) {
  const rejected = status === "rejected";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef2e7] p-4 text-foreground">
      <Card className="w-full max-w-lg border-[#d7ccb3] bg-[#fffdf7] shadow-warm">
        <CardHeader className="items-center text-center">
          <AgentAvatar />
          <CardTitle className="mt-3 text-2xl text-[#263421]">
            {rejected ? "Înregistrare respinsă" : "În așteptarea aprobării"}
          </CardTitle>
          <CardDescription className="max-w-md text-base leading-relaxed text-[#62705a]">
            {rejected
              ? `Contul tău de ${accountLabel} nu a fost aprobat de echipa Flavours of Dobrogea. Poți contacta administratorii dacă ai întrebări.`
              : `Contul tău de ${accountLabel} a fost trimis echipei Flavours of Dobrogea. Ei verifică datele și te pot contacta telefonic înainte de aprobare.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              rejected ? "border-[#e8b4a8] bg-[#fdf0ec]" : "border-[#ded5bf] bg-[#fbf7ed]"
            }`}
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                rejected ? "bg-[#f4ddd7] text-[#884636]" : "bg-[#e9f0dc] text-[#4d6638]"
              }`}
            >
              {rejected ? <ShieldX className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
            </span>
            <div className="text-sm leading-relaxed text-[#526047]">
              {rejected
                ? "Dacă crezi că a fost o greșeală, scrie-ne sau încearcă din nou cu date actualizate."
                : "După aprobare vei putea folosi platforma complet: potriviri, chat și contact cu partenerii locali."}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {!rejected ? (
              <Button variant="honey" onClick={() => void onRefresh()} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {refreshing ? "Se verifică..." : "Verifică din nou"}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void onLogout()} className={rejected ? "sm:col-span-2" : ""}>
              Ieși din cont
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default PendingApprovalScreen;
