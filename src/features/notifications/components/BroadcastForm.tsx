"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UiDbError } from "@/lib/supabase/db-errors";
import { useSendBroadcast } from "../hooks/use-broadcast";
import type { BroadcastTarget } from "../api/notifications.api";

const TARGETS: { value: BroadcastTarget; label: string; hint: string }[] = [
  { value: "recent", label: "সাম্প্রতিক কাস্টমার", hint: "গত ৩০ দিনে বুকিং করেছে" },
  { value: "regulars", label: "নিয়মিত কাস্টমার", hint: "কমপক্ষে ২ বার সার্ভিস নিয়েছে" },
];

export function BroadcastForm({ shopId }: { shopId: string }) {
  const [target, setTarget] = useState<BroadcastTarget>("recent");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = useSendBroadcast(shopId);

  const disabled = !title.trim() || !body.trim() || send.isPending;

  return (
    <form
      className="mx-auto max-w-lg space-y-4.5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setResult(null);
        send.mutate(
          { target, title: title.trim(), body: body.trim() },
          {
            onSuccess: (count) => {
              setResult(`${count} জন কাস্টমারকে পাঠানো হয়েছে।`);
              setTitle("");
              setBody("");
            },
            onError: (err) => {
              setError(err instanceof UiDbError ? err.message : "কিছু একটা ভুল হয়েছে");
            },
          },
        );
      }}
    >
      <div>
        <h1 className="font-display text-xl font-bold text-ink">নোটিফিকেশন পাঠান</h1>
        <p className="mt-1 text-sm text-muted">
          তোমার কাস্টমারদের কাছে সরাসরি একটা মেসেজ পাঠাও — দিনে একবার।
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-ink">টার্গেট</p>
        <div className="flex gap-2">
          {TARGETS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTarget(t.value)}
              className={
                target === t.value
                  ? "flex-1 rounded-[14px] border border-accent bg-accent/10 p-3 text-left"
                  : "flex-1 rounded-[14px] border border-line bg-card p-3 text-left"
              }
            >
              <p className="text-[13px] font-semibold text-ink">{t.label}</p>
              <p className="text-[11px] text-muted">{t.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-ink" htmlFor="broadcast-title">
          টাইটেল
        </label>
        <input
          id="broadcast-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="যেমন: আজ ২০% ছাড়!"
          className="w-full rounded-[12px] border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-ink" htmlFor="broadcast-body">
          মেসেজ
        </label>
        <textarea
          id="broadcast-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          rows={4}
          placeholder="বিস্তারিত লিখো…"
          className="w-full resize-none rounded-[12px] border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-live">{error}</p>}
      {result && <p className="text-sm text-good">{result}</p>}

      <Button type="submit" size="lg" disabled={disabled} loading={send.isPending} className="w-full">
        <Megaphone className="h-4 w-4" />
        পাঠাও
      </Button>
    </form>
  );
}
