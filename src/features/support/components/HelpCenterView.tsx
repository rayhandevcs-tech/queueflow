"use client";

import { useMemo, useState } from "react";
import { Globe, MessageCircle, Phone, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { AccordionItem } from "@/components/ui/Accordion";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { FAQ_CATEGORIES, FAQ_ITEMS } from "../lib/faq-data";
import { SUPPORT_CONTACT } from "../lib/contact-info";

export function HelpCenterView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (category && item.category !== category) return false;
      if (!q) return true;
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <div className="space-y-5">
      <Input
        icon={<Search className="h-4 w-4" />}
        placeholder="প্রশ্ন খুঁজো..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
            category === null ? "border-accent bg-accent text-accent-ink" : "border-line bg-soft text-ink",
          )}
        >
          সব
        </button>
        {FAQ_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory((prev) => (prev === c.value ? null : c.value))}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              category === c.value
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-soft text-ink",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="কোনো প্রশ্ন পাওয়া যায়নি"
          description="অন্য শব্দ দিয়ে খুঁজে দেখো, অথবা সরাসরি যোগাযোগ করো।"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <AccordionItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      )}

      <div className="rounded-[18px] border border-line bg-card p-5">
        <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
          সরাসরি যোগাযোগ
        </p>
        <div className="space-y-3">
          <a
            href={`tel:${SUPPORT_CONTACT.phone}`}
            className="flex items-center gap-3 text-sm font-medium text-ink"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Phone className="h-4 w-4" />
            </span>
            {SUPPORT_CONTACT.phoneDisplay}
          </a>
          <a
            href={`https://wa.me/${SUPPORT_CONTACT.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm font-medium text-ink"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <MessageCircle className="h-4 w-4" />
            </span>
            হোয়াটসঅ্যাপে মেসেজ দাও
          </a>
          <a
            href={`https://${SUPPORT_CONTACT.facebook}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm font-medium text-ink"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Globe className="h-4 w-4" />
            </span>
            {SUPPORT_CONTACT.facebook}
          </a>
          <a
            href={`https://${SUPPORT_CONTACT.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm font-medium text-ink"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Globe className="h-4 w-4" />
            </span>
            {SUPPORT_CONTACT.instagram}
          </a>
        </div>
      </div>
    </div>
  );
}
