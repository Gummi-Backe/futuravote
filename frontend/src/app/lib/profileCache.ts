export const PROFILE_SUMMARY_CACHE_KEY = "fv_profile_summary_v1";
export const PROFILE_LISTS_CACHE_KEY = "fv_profile_lists_v1";
export const PROFILE_ACTIVITY_CACHE_PREFIX = "fv_profile_activity_v1:";
export const PROFILE_NOTIFICATION_PREFS_CACHE_KEY = "fv_profile_notification_prefs_v1";

export function invalidateProfileCaches() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PROFILE_SUMMARY_CACHE_KEY);
    window.sessionStorage.removeItem(PROFILE_LISTS_CACHE_KEY);
    window.sessionStorage.removeItem(PROFILE_NOTIFICATION_PREFS_CACHE_KEY);

    // Profil-Aktivitaet (Listen) ebenfalls invalidieren
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(PROFILE_ACTIVITY_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
