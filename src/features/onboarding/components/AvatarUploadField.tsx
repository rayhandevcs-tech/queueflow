"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { uploadUserAvatar } from "../api/storage.api";

interface Props {
  userId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

export function AvatarUploadField({ userId, currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const src = preview ?? currentUrl;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadUserAvatar(userId, file);
      onUploaded(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "আপলোড ব্যর্থ হয়েছে");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-ink">প্রোফাইল ছবি</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-line bg-soft text-muted transition-colors hover:border-accent/50 hover:bg-accent/5"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="প্রোফাইল ছবি" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImagePlus className="h-5 w-5" />
            ছবি বেছে নাও
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-card/70">
            <Spinner className="h-5 w-5 text-ink" />
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {error && <p className="text-xs text-live">{error}</p>}
    </div>
  );
}
