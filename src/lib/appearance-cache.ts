import { preferenceStyleVariables, type Preferences } from "./preferences";

const CACHE_KEY = "mindcraft-appearance";

// Stores the computed CSS variables so the inline script in the root layout
// can apply them before React loads. The database remains the source of truth.
export function cacheAppearance(preferences: Preferences) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        vars: preferenceStyleVariables(preferences),
        theme: preferences.theme,
        motion: preferences.reducedMotion,
        size: preferences.textSize,
      }),
    );
  } catch {
    // Storage unavailable: the theme still applies once data loads.
  }
}

export function clearAppearanceCache() {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export const APPEARANCE_BOOTSTRAP_SCRIPT = `(function(){try{var c=JSON.parse(localStorage.getItem("${CACHE_KEY}")||"null");if(!c)return;var r=document.documentElement;for(var k in c.vars)r.style.setProperty(k,c.vars[k]);r.dataset.theme=c.theme;r.dataset.motion=c.motion;r.style.fontSize=c.size+"px";r.style.colorScheme=c.theme==="dark"?"dark":"light";}catch(e){}})();`;
