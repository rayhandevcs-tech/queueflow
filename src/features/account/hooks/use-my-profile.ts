"use client";

import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { getMyProfile } from "../api/profile.api";

export function useMyProfile() {
  return useQuery({ queryKey: keys.profile.mine(), queryFn: getMyProfile });
}
