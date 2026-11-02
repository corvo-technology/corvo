import type { Locale } from "../locales";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import ja from "./ja";
import pt from "./pt";
import type { LaunchCopy } from "./types";
import zh from "./zh";

export type {
  LaunchAgent,
  LaunchCopy,
  PreviewConversation,
  PreviewMessage,
  StoreCategory,
} from "./types";

const COPY: Record<Locale, LaunchCopy> = { en, pt, es, fr, de, ja, zh };

/** Every language the app speaks is written out, so the page reads the same in each. */
export function getLaunchCopy(locale: Locale): LaunchCopy {
  return COPY[locale];
}
