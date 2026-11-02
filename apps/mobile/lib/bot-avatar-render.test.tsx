// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BotAvatar } from "../components/bot-avatar";

vi.mock("./mascot-images", () => ({
  MASCOT_IMAGES: {
    mint: 1,
    violet: 2,
    orange: 3,
    blue: 4,
    pink: 5,
    red: 6,
    yellow: 7,
    lime: 8,
    cyan: 9,
    neutral: 10,
  },
}));

vi.mock("react-native", () => ({
  View: ({ children, accessibilityLabel }: { children?: ReactNode; accessibilityLabel?: string }) =>
    createElement("div", { "aria-label": accessibilityLabel }, children),
  AppState: { currentState: "active", addEventListener: () => ({ remove: () => undefined }) },
  Pressable: ({ children }: { children?: ReactNode }) =>
    createElement("button", { type: "button" }, children),
  Image: ({ source }: { source: { uri?: string } | number }) =>
    createElement("img", { src: typeof source === "number" ? `asset:${source}` : source.uri }),
}));

vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("./native", () => ({
  useMobileTokens: () => ({ background: "#FFF", workingDot: "#3FA266", secondary: "#EEE" }),
}));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));

describe("BotAvatar", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  function render(color: string, status?: string) {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<BotAvatar color={color} size={42} status={status} />));
    return container;
  }

  it("shows the mascot of the bot's color", () => {
    expect(render("#8B5CF6").querySelector("img")?.getAttribute("src")).toBe("asset:2");
  });

  it("shows the same mascot for a bot saved with an older shape", () => {
    expect(render("#8B5CF6::shape_3").querySelector("img")?.getAttribute("src")).toBe("asset:2");
  });

  it("keeps a picture", () => {
    const view = render("data:image/png;base64,abc");
    expect(view.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,abc");
  });

  it("marks a working bot with the working dot only", () => {
    expect(render("#8B5CF6", "running").querySelector('[aria-label="Working"]')).not.toBeNull();
  });

  it("has no working dot at rest", () => {
    expect(render("#8B5CF6").querySelector('[aria-label="Working"]')).toBeNull();
  });
});
