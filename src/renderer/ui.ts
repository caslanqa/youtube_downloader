// Shared class strings. Not a component abstraction, just one place for the repeated Tailwind
// sequences; the tokens themselves live in src/index.css.

export const PANEL = 'rounded-xl border border-line-soft bg-panel p-6 shadow-sm';

export const LABEL = 'mb-1.5 block text-sm font-medium text-muted';

export const FIELD =
  'w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/70 ' +
  'focus:border-brand focus:outline-none disabled:opacity-50';

export const BUTTON_PRIMARY =
  'rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors ' +
  'hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50';

export const BUTTON_QUIET =
  'rounded-lg border border-line px-3 py-2 text-sm text-ink transition-colors hover:bg-surface';

// WCAG 2.5.8: even small text-button targets must be at least 24x24 CSS px.
export const BUTTON_INLINE = 'rounded px-2 py-1 text-sm underline-offset-2 hover:underline';
