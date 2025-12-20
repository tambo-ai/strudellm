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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCodeState(stored);
      }
    } catch (error) {
      // localStorage access may fail in restricted storage environments (e.g., private browsing)
      if (process.env.NODE_ENV === "development") {
        console.warn("Failed to load from localStorage:", error);
      }
    }
    setIsLoaded(true);
  }, []);

  const setCode = useCallback((newCode: string) => {
    setCodeState(newCode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, newCode);
      } catch (error) {
        // localStorage access may fail in restricted storage environments (e.g., private browsing)
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to save to localStorage:", error);
        }
      }
    }
  }, []);

  const resetCode = useCallback(() => {
    setCodeState(DEFAULT_CODE);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, DEFAULT_CODE);
      } catch (error) {
        // localStorage access may fail in restricted storage environments (e.g., private browsing)
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to reset code in localStorage:", error);
        }
      }
    }
  }, []);

  return useMemo(() => ({
    code,
    setCode,
    resetCode,
    isLoaded,
  }), [code, setCode, resetCode, isLoaded]);
}
