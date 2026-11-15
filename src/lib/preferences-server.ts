import { cookies } from "next/headers";
import {
  parsePreferences,
  PREFS_COOKIE,
  type Preferences,
} from "./preferences";

export async function getPreferences(): Promise<Preferences> {
  const raw = (await cookies()).get(PREFS_COOKIE)?.value;
  return parsePreferences(raw);
}
