"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { removeById, upsertById } from "@/lib/query/realtime-cache";
import type { ShopGalleryImage } from "@/types";
import { addGalleryImage, deleteGalleryImage, getMyShopGallery } from "../api/gallery.api";
import { deleteShopGalleryStorageObject, uploadShopGalleryImage } from "../api/storage.api";

const bySortOrder = (a: ShopGalleryImage, b: ShopGalleryImage) => a.sort_order - b.sort_order;

export function useShopGallery(shopId: string | undefined) {
  return useQuery({
    queryKey: keys.shopGallery.byShop(shopId ?? ""),
    queryFn: () => getMyShopGallery(shopId!),
    enabled: !!shopId,
  });
}

export function useShopGalleryMutations(shopId: string) {
  const queryClient = useQueryClient();
  const listKey = keys.shopGallery.byShop(shopId);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const current = queryClient.getQueryData<ShopGalleryImage[]>(listKey)?.length ?? 0;
      const { url, path } = await uploadShopGalleryImage(shopId, file);
      return addGalleryImage(shopId, { url, path }, current + 1);
    },
    onSuccess: (image) => {
      queryClient.setQueryData<ShopGalleryImage[]>(listKey, (rows) =>
        upsertById(rows, image, bySortOrder),
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (image: ShopGalleryImage) => {
      await deleteGalleryImage(image.id);
      await deleteShopGalleryStorageObject(image.path);
    },
    onSuccess: (_void, image) => {
      queryClient.setQueryData<ShopGalleryImage[]>(listKey, (rows) =>
        removeById(rows, image.id),
      );
    },
  });

  return { upload, remove };
}
