// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement, useRef } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityMark, MARK_SPRING, ROW_HEIGHT, ROW_MS } from "../components/activity-mark";
import { AvatarScreenFocus } from "./avatar-life";

const CLOCK_MS = 24 * 60 * 60 * 1000;
const motion = vi.hoisted(() => ({
  reducedMotion: false,
  /** Every timing started: [target, duration]. */
  timings: [] as Array<[unknown, number]>,
  /** Every spring started: [target, config]. */
  springs: [] as Array<[unknown, Record<string, number> | undefined]>,
  cancelled: 0,
}));

vi.mock("react-native-reanimated", () => {
  const passthrough = ({ children, style }: { children?: ReactNode; style?: unknown }) =>
    createElement(
      "div",
      { "data-opacity": Object.assign({}, ...[style].flat()).opacity },
      children,
    );
  const easing = (value: unknown) => value;
  const fade = { duration: () => ({}) };
  return {
    default: { View: passthrough, createAnimatedComponent: () => passthrough },
    cancelAnimation: () => {
      motion.cancelled += 1;
    },
    Easing: { in: easing, out: easing, inOut: easing, quad: 0, cubic: 0, linear: 0 },
    FadeIn: fade,
    FadeOut: fade,
    ReduceMotion: { Never: "never" },
    useAnimatedProps: (worklet: () => unknown) => worklet(),
    useAnimatedStyle: (worklet: () => unknown) => worklet(),
    useReducedMotion: () => motion.reducedMotion,
    useSharedValue: <T,>(value: T) => useRef({ value }).current,
    withSpring: (value: unknown, config?: Record<string, number>) => {
      motion.springs.push([value, config]);
      return value;
    },
    withTiming: (value: unknown, config?: { duration?: number }) => {
      motion.timings.push([value, config?.duration ?? 0]);
      return value;
    },
  };
});
vi.mock("react-native-svg", () => {
  const element = ({ children, fill }: { children?: ReactNode; fill?: string }) =>
    createElement("div", { "data-fill": fill }, children);
  return { default: element, Ellipse: element, G: element, Path: element, Rect: element };
});
vi.mock("react-native", () => ({
  View: ({
    children,
    accessibilityLabel,
    style,
  }: {
    children?: ReactNode;
    accessibilityLabel?: string;
    style?: { width?: number; backgroundColor?: string; borderColor?: string };
  }) =>
    createElement(
      "div",
      {
        "aria-label": accessibilityLabel,
        "data-width": style?.width,
        "data-bg": style?.backgroundColor,
        "data-ring": style?.borderColor,
      },
      children,
    ),
  Pressable: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) =>
    createElement("button", { type: "button", onClick: onPress }, children),
  Image: ({ source }: { source: unknown }) => createElement("img", { src: String(source) }),
  AppState: { currentState: "active", addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock("./mascot-images", () => ({
  MASCOT_IMAGES: Object.fromEntries(
    ["mint", "blue", "violet", "pink", "red", "orange", "yellow", "lime", "cyan", "neutral"].map(
      (id) => [id, id],
    ),
  ),
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));
vi.mock("./native", () => ({
  useMobileTokens: () => ({
    mutedForeground: "#888",
    background: "#FFF",
    workingDot: "#3FA266",
    secondary: "#EEE",
  }),
}));

const SHAPE = "#2A92FE::shape_2";

describe("activity mark", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    motion.reducedMotion = false;
    motion.timings = [];
    motion.springs = [];
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const render = (node: ReactNode) => act(() => root.render(node));
  const bots = [
    { id: "bot-a", color: SHAPE, status: "running" },
    { id: "bot-b", color: "#FF781C", status: "running" },
  ];
  /** The mark's grow-in spring. */
  const grewIn = () => motion.springs.some(([, config]) => config === MARK_SPRING);

  it("opens its row and grows in only once the chat is at the newest message", () => {
    render(<ActivityMark bots={bots.slice(0, 1)} atBottom={false} />);
    expect(motion.timings).toContainEqual([ROW_HEIGHT, ROW_MS]);
    expect(grewIn()).toBe(false);
    render(<ActivityMark bots={bots.slice(0, 1)} atBottom />);
    expect(grewIn()).toBe(true);
  });

  it("shows each working member of a group in turn, every 2 s", () => {
    render(<ActivityMark bots={bots} atBottom />);
    const shown = () => container.querySelector("img")?.getAttribute("src");
    expect(shown()).toBe("blue");
    act(() => vi.advanceTimersByTime(2000));
    expect(shown()).toBe("orange");
  });

  it("stops cycling members and pulsing photo dots on a covered screen, and resumes on return", () => {
    let focused = false;
    const listeners = new Set<() => void>();
    const navigation = {
      isFocused: () => focused,
      addListener: (_event: "focus" | "blur", listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const photo = { id: "bot-p", color: "data:image/png;base64,AAAA", status: "running" };
    const pulsing = () => motion.timings.some(([, duration]) => duration === CLOCK_MS);
    render(
      <AvatarScreenFocus navigation={navigation}>
        <ActivityMark bots={[photo, bots[0]!]} atBottom />
      </AvatarScreenFocus>,
    );
    const drawnShown = () => container.querySelector("img") !== null;
    act(() => vi.advanceTimersByTime(6000));
    expect(drawnShown()).toBe(false);
    expect(pulsing()).toBe(false);
    focused = true;
    act(() => {
      for (const listener of listeners) listener();
    });
    expect(pulsing()).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(drawnShown()).toBe(true);
  });

  it("holds still on the first member under Reduce Motion and appears at once", () => {
    motion.reducedMotion = true;
    render(<ActivityMark bots={bots} atBottom />);
    const first = container.innerHTML;
    act(() => vi.advanceTimersByTime(6000));
    expect(container.innerHTML).toBe(first);
    expect(grewIn()).toBe(false);
  });

  it("shows typing dots instead of the mascot while its bot writes", () => {
    render(<ActivityMark bots={[{ ...bots[0]!, composing: true }]} atBottom />);
    expect(container.querySelectorAll("[data-opacity]")).toHaveLength(3);
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows plain typing dots instead of a photo, including a photo member's turn in a group", () => {
    const photo = { id: "bot-p", color: "data:image/png;base64,AAAA", status: "running" };
    const dots = () => container.querySelectorAll("[data-opacity]").length;
    render(<ActivityMark bots={[photo, bots[0]!]} atBottom />);
    expect(dots()).toBe(3);
    expect(container.querySelector("img")).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelector("img")).not.toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(dots()).toBe(3);
  });
});
