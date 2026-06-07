import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PlatformRegisteredBadge() {
  return (
    <Badge
      variant="blue"
      className="inline-flex shrink-0 items-center gap-1 border-[#9ec5d8] bg-[#e8f3f8] text-[#24556b]"
    >
      <BadgeCheck className="h-3 w-3" />
      Înregistrat
    </Badge>
  );
}
