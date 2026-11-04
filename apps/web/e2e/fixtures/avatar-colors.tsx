import { BotAvatar } from "@corvo/ui-web";
import { I18nProvider } from "@lingui/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { bootstrapI18n, i18n } from "../../src/lib/i18n";
import { applyResolvedAppearance } from "../../src/lib/ui-appearance";
import "../../src/styles.css";
import { BotLookPicker } from "../../src/pages/shell/avatar-studio-popover";

// The color picker of Avatar Studio and the chick in colors of one's own, so the look can be
// checked without a backend. State lives in the URL (?theme=light|dark).

const OWN_COLORS = ["#14B8A6", "#FFEB3B", "#FF00FF", "#1A237E", "#000000", "#7F7F7F", "#FAFAFA"];
const SIZES = [16, 28, 44, 78];

function Page() {
  const [value, setValue] = useState("#3B82F6");
  return (
    <main className="flex min-h-screen flex-col gap-8 bg-background p-8 text-foreground">
      <section className="w-[300px]" data-testid="picker">
        <BotLookPicker value={value} onChange={setValue} />
        <div className="mt-4 flex items-center gap-3" data-testid="worn">
          <BotAvatar color={value} size={44} />
          <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
        </div>
      </section>
      <section className="flex flex-col gap-3" data-testid="own-colors">
        {OWN_COLORS.map((color) => (
          <div key={color} className="flex items-center gap-4">
            <span className="w-20 text-xs tabular-nums text-muted-foreground">{color}</span>
            {SIZES.map((size) => (
              <BotAvatar key={size} color={color} size={size} identity={`bot-${color}`} />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}

const theme = new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark";
applyResolvedAppearance(theme);
await bootstrapI18n("en");
createRoot(document.getElementById("root")!).render(
  <I18nProvider i18n={i18n}>
    <Page />
  </I18nProvider>,
);
