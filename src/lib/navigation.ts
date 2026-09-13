/**
 * Navigates to a URL in the same Chrome tab.
 * In a framed or preview environment, navigates window.top (the top-level tab).
 * In a standalone tab, navigates the current window.
 */
export function navigateSameTab(url: string) {
  if (!url) return;
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Cross-origin restriction fallback
  }
  window.location.href = url;
}
