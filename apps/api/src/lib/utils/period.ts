import { APP_TZ } from "$/env";

/** Today as "yyyy-MM-dd" in the app timezone. */
export function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
}
