import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProPaywallDialog({
  open,
  message,
  upgrading,
  onOpenChange,
  onUpgrade,
}: {
  open: boolean;
  message: string;
  upgrading?: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Treci la Pro</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm text-[#34422d]">
          <li>• Până la 15 lead-uri active</li>
          <li>• Caută alte lead-uri până umpli lista</li>
          <li>• Statistici pipeline în Director</li>
          <li>• Detalii bogate și simulări nelimitate</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="honey" disabled={upgrading} onClick={onUpgrade}>
            {upgrading ? "Se activează..." : (
              <>
                <Sparkles className="h-4 w-4" />
                Activează Pro (demo)
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Mai târziu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
