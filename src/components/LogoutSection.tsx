import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutSection({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-4">
      <p className="text-sm font-bold text-[#263421]">Cont</p>
      <p className="mt-1 text-xs text-muted-foreground">Ieși din cont pe acest dispozitiv.</p>
      <Button
        type="button"
        variant="outline"
        onClick={onLogout}
        className="mt-3 border-rose-200 text-rose-800 hover:border-rose-300 hover:bg-rose-50"
      >
        <LogOut className="h-4 w-4" />
        Deconectare
      </Button>
    </div>
  );
}
