"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useDeleteMyAccount } from "../hooks/use-delete-account";

export function DeleteAccountSection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteAccount = useDeleteMyAccount();

  return (
    <>
      <Button
        variant="danger"
        size="lg"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        className="w-full"
      >
        <Trash2 className="h-4 w-4" />
        অ্যাকাউন্ট মুছে ফেলো
      </Button>
      {error && <p className="mt-2 text-center text-xs font-medium text-live">{error}</p>}

      <ConfirmSheet
        open={confirmOpen}
        title="অ্যাকাউন্ট মুছে ফেলবে?"
        description="প্রোফাইল, চ্যাট, রিভিউ, ফেভারিট আর নোটিফিকেশন স্থায়ীভাবে মুছে যাবে — এটা ফেরানো যায় না।"
        confirmLabel="মুছে ফেলো"
        cancelLabel="থাক"
        loading={deleteAccount.isPending}
        onConfirm={() =>
          deleteAccount.mutate(undefined, {
            onError: (err) => {
              setConfirmOpen(false);
              setError(err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে।");
            },
          })
        }
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
