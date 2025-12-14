export const PROFILE_SUMMARY_CACHE_KEY = "fv_profile_summary_v1";
export const PROFILE_LISTS_CACHE_KEY = "fv_profile_lists_v1";

export function invalidateProfileCaches() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PROFILE_SUMMARY_CACHE_KEY);
    window.sessionStorage.removeItem(PROFILE_LISTS_CACHE_KEY);
  } catch {
    // ignore
  }
}

