"use client";

import { useCallback, useMemo, useState, useEffect } from "react";

const STORAGE_KEY = "strudel-code";
const DEFAULT_CODE = `// Welcome to Strudel!
// Try: sound("bd sd")`;

export interface SimpleStrudelStorage {
  code: string;
  setCode: (code: string) => void;
  resetCode: () => void;
  isLoaded: boolean;
}

export function useStrudelStorage(): SimpleStrudelStorage {
  const [code, setCodeState] = useState(DEFAULT_CODE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setCodeState(stored);
    }
    setIsLoaded(true);
  }, []);

  const setCode = useCallback((newCode: string) => {
    setCodeState(newCode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newCode);
    }
  }, []);

  const resetCode = useCallback(() => {
    setCodeState(DEFAULT_CODE);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, DEFAULT_CODE);
    }
  }, []);

  return useMemo(() => ({
    code,
    setCode,
    resetCode,
    isLoaded,
  }), [code, setCode, resetCode, isLoaded]);
}
