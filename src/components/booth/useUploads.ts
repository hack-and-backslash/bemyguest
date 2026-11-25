"use client";

import { useSyncExternalStore } from "react";
import { uploads } from "@/lib/booth/uploader";

export function useUploads() {
  return useSyncExternalStore(uploads.subscribe, uploads.get, uploads.getServer);
}
