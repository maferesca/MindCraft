// Returns keyboard focus after a dialog or panel closes. It uses the element that
// opened it, or the workspace if that element is gone (a deleted task, a closed
// menu). Focus that has already moved on, such as into the next panel, is left alone.
export function restoreFocus(opener: HTMLElement | null) {
  const active = document.activeElement;
  if (active && active !== document.body) return;
  if (opener?.isConnected && opener !== document.body) opener.focus();
  else document.getElementById("main")?.focus({ preventScroll: true });
}
