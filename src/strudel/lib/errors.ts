export function isSampleErrorMessage(message: string): boolean {
  if (/\b(?:sound|sample)\s+.+\s+not\s+found\b/i.test(message)) {
    return true;
  }

  return (
    /\b(?:sound|sample)\b/i.test(message) &&
    /(not found|not loaded|is it loaded)/i.test(message)
  );
}
