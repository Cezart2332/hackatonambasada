import React from "react";
import { Handshake } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function AgentAvatar({ small = false }: { small?: boolean }) {
  return (
    <Avatar className={cn("border border-[#d7ccb3] bg-[#eaf0df]", small ? "h-10 w-10" : "h-11 w-11")}>
      <AvatarFallback className="bg-[#4d6638] text-[#fff7df]">
        <Handshake className={cn(small ? "h-4 w-4" : "h-5 w-5")} />
      </AvatarFallback>
    </Avatar>
  );
}
