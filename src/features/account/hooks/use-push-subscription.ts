"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteMyPushSubscription, hasMyPushSubscription, saveMyPushSubscription } from "../api/push.api";
import { translate } from "@/lib/i18n";
import { accountDict } from "../lib/i18n";

type PushStatus = "loading" | "unsupported" | "subscribed" | "unsubscribed" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Registers the service worker + tracks/toggles this device's push subscription. */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const sub = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (sub?.endpoint && (await hasMyPushSubscription(sub.endpoint))) {
          setStatus("subscribed");
        } else {
          setStatus(Notification.permission === "denied" ? "denied" : "unsubscribed");
        }
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as BufferSource,
      });
      await saveMyPushSubscription(sub.toJSON());
      setStatus("subscribed");
    } catch {
      setError(translate(accountDict, "pushSubscribeFailed"));
    } finally {
      setIsPending(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await deleteMyPushSubscription(endpoint);
      }
      setStatus("unsubscribed");
    } catch {
      setError(translate(accountDict, "pushSubscribeFailed"));
    } finally {
      setIsPending(false);
    }
  }, []);

  return { status, isPending, error, subscribe, unsubscribe };
}
