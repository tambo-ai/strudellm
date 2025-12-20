"use client";

import { useStrudelStorage } from "@/hooks/use-strudel-storage";
import { StrudelService } from "@/strudel/lib/service";
import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 1000;

/**
 * Component that syncs the simple storage with StrudelService.
 * Handles loading code from localStorage on mount and saving changes with debouncing.
 */
export function StrudelStorageSync() {
  const storage = useStrudelStorage();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Load code from storage on mount
  useEffect(() => {
    if (!storage.isLoaded || initialLoadDoneRef.current) {
      return;
    }

    initialLoadDoneRef.current = true;
    const service = StrudelService.instance();

    // Load the stored code into the editor
    if (storage.code) {
      service.setCode(storage.code);
    }
  }, [storage.isLoaded, storage.code]);

  // Subscribe to code changes from the editor and save with debounce
  useEffect(() => {
    const service = StrudelService.instance();

    const unsubscribe = service.onStateChange((state) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounced save
      debounceTimerRef.current = setTimeout(() => {
        if (state.code) {
          storage.setCode(state.code);
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [storage]);

  return null;
}
