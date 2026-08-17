/** mm:ss, or null when the duration is unknown (a playlist entry, a live stream, ...). */
export function formatDuration(seconds?: number): string | null {
  if (seconds === undefined) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
