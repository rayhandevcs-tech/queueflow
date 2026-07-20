"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import type { Serial } from "@/types";
import {
  addWalkIn,
  cancelByOwner,
  completeSerial,
  markNoShow,
  moveSerial,
  startSerial,
  type WalkInPayload,
} from "../api/serial-actions.api";

type BoardSnapshot = { previous: Serial[] | undefined };

export function useSerialActions(shopId: string) {
  const queryClient = useQueryClient();
  const boardKey = keys.serials.byShop(shopId);

  const snapshot = async (): Promise<BoardSnapshot> => {
    await queryClient.cancelQueries({ queryKey: boardKey });
    return { previous: queryClient.getQueryData<Serial[]>(boardKey) };
  };

  const rollback = (ctx: BoardSnapshot | undefined) => {
    if (ctx?.previous) queryClient.setQueryData(boardKey, ctx.previous);
  };

  const reconcile = () => {
    void queryClient.invalidateQueries({ queryKey: boardKey });
  };

  const patchStatusLocally = (serialId: string, status: Serial["status"]) => {
    queryClient.setQueryData<Serial[]>(boardKey, (rows) =>
      rows?.map((r) => (r.id === serialId ? { ...r, status } : r)) ?? [],
    );
  };

  const removeLocally = (serialId: string) => {
    queryClient.setQueryData<Serial[]>(boardKey, (rows) =>
      rows ? rows.filter((r) => r.id !== serialId) : [],
    );
  };

  // ---- optimistic four -----------------------------------------------------

  const start = useMutation({
    mutationFn: (serialId: string) => startSerial(serialId),
    onMutate: async (serialId) => {
      const ctx = await snapshot();
      patchStatusLocally(serialId, "IN_PROGRESS");
      return ctx;
    },
    onError: (_err, _serialId, ctx) => rollback(ctx),
    onSettled: reconcile,
  });

  const complete = useMutation({
    mutationFn: (serialId: string) => completeSerial(serialId),
    onMutate: async (serialId) => {
      const ctx = await snapshot();
      removeLocally(serialId); // DONE leaves the board immediately
      return ctx;
    },
    onError: (_err, _serialId, ctx) => rollback(ctx),
    onSettled: reconcile,
  });

  const noShow = useMutation({
    mutationFn: (serialId: string) => markNoShow(serialId),
    onMutate: async (serialId) => {
      const ctx = await snapshot();
      removeLocally(serialId);
      return ctx;
    },
    onError: (_err, _serialId, ctx) => rollback(ctx),
    onSettled: reconcile,
  });

  const cancel = useMutation({
    mutationFn: (serialId: string) => cancelByOwner(serialId),
    onMutate: async (serialId) => {
      const ctx = await snapshot();
      removeLocally(serialId);
      return ctx;
    },
    onError: (_err, _serialId, ctx) => rollback(ctx),
    onSettled: reconcile,
  });

  // ---- intent-only two -----------------------------------------------------
  // The DB decides chair / position / snapshot — nothing sensible to fake.

  const walkIn = useMutation({
    mutationFn: (payload: Omit<WalkInPayload, "shopId">) =>
      addWalkIn({ ...payload, shopId }),
    // No onMutate: dialog shows its own pending state; the realtime INSERT
    // places the card in the winning lane.
    onSettled: reconcile,
  });

  const move = useMutation({
    mutationFn: ({
      serialId,
      targetChairId,
    }: {
      serialId: string;
      targetChairId: string;
    }) => moveSerial(serialId, targetChairId),
    onSettled: reconcile,
  });

  return { start, complete, noShow, cancel, walkIn, move };
}