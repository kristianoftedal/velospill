import { format } from "date-fns"

/**
 * Format a date for display: "24 Mar 2026"
 * Works correctly in both server and client components for date-only values.
 */
export function formatDate(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy")
}

/**
 * Format a date with time: "24 Mar 2026 14:30"
 * In client components, this shows the browser's local timezone.
 */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy HH:mm")
}

/**
 * Format just the time: "14:30"
 */
export function formatTime(date: Date | string): string {
  return format(new Date(date), "HH:mm")
}

/**
 * Short date format: "24 Mar"
 */
export function formatDateShort(date: Date | string): string {
  return format(new Date(date), "d MMM")
}
