"use client";

import { useStoreUser } from "@/hooks/use-store-user";

export function AuthSync() {
  useStoreUser();
  return null;
}
