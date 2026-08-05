"use client";

import { MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { chatDict } from "../lib/i18n";

export function EmptyDetailPlaceholder() {
  const t = useT(chatDict);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="grid h-13 w-13 place-items-center rounded-full bg-accent/10 text-accent">
        <MessageCircle className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-muted">{t("selectConversationHint")}</p>
    </div>
  );
}
