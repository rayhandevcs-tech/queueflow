"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getMyFavorites, setFavoriteWaitAlert } from "../api/favorites.api";
import { deleteMyReminder, getMyReminder, saveMyReminder } from "../api/reminder.api";

export function useMyFavoriteRows() {
  const queryClient = useQueryClient();
  const favoritesKey = keys.favorites.rows();

  const query = useQuery({
    queryKey: favoritesKey,
    queryFn: getMyFavorites,
  });

  const setAlert = useMutation({
    mutationFn: ({ favoriteId, waitAlertMin }: { favoriteId: string; waitAlertMin: number | null }) =>
      setFavoriteWaitAlert(favoriteId, waitAlertMin),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoritesKey });
    },
  });

  return { favorites: query.data ?? [], isPending: query.isPending, setAlert };
}

export function useMyReminder() {
  const queryClient = useQueryClient();
  const reminderKey = keys.reminder.mine();

  const query = useQuery({
    queryKey: reminderKey,
    queryFn: getMyReminder,
  });

  const save = useMutation({
    mutationFn: ({ intervalDays, shopId }: { intervalDays: number; shopId: string | null }) =>
      saveMyReminder(intervalDays, shopId),
    onSuccess: (row) => {
      queryClient.setQueryData(reminderKey, row);
    },
  });

  const remove = useMutation({
    mutationFn: deleteMyReminder,
    onSuccess: () => {
      queryClient.setQueryData(reminderKey, null);
    },
  });

  return { reminder: query.data ?? null, isPending: query.isPending, save, remove };
}
