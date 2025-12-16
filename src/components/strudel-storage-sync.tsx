"use client";

import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { StrudelService } from "@/strudel/lib/service";
import { useEffect } from "react";

/**
 * Component that syncs the storage adapter between Jazz and StrudelService.
 * Must be rendered inside both JazzAndAuthProvider and StrudelProvider.
 */
export function StrudelStorageSync() {
  const storage = useStrudelStorage();

  useEffect(() => {
    const service = StrudelService.instance();
    service.setStorageAdapter(storage);
  }, [storage]);

  return null;
}
