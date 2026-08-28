import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Return a date string (YYYY-MM-DD) that is ~N months in the future,
 * pinned to the 15th of the target month to avoid boundary edge cases.
 *
 * The month offset is configurable via the `FLIGHTRESIST_SEARCH_MONTH_OFFSET`
 * env var (integer, default 3). Keeps the search date perpetually valid
 * regardless of when the app is deployed or demonstrated.
 */
export function getDynamicSearchDate(): string {
  const monthOffset = Math.max(1, Number(process.env.FLIGHTRESIST_SEARCH_MONTH_OFFSET ?? 3));
  const target = new Date();
  target.setMonth(target.getMonth() + monthOffset);
  target.setDate(15);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
