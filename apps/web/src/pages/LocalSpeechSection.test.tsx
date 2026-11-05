// @vitest-environment jsdom

import type { LocalSpeechModel, VoiceCredential } from "@corvo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const voice = vi.hoisted(() => ({
  localModels: vi.fn(),
  downloadLocalModel: vi.fn(),
  cancelLocalModelDownload: vi.fn(),
  removeLocalModel: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("../lib/space-rpc", () => ({ useSpaceRpc: () => ({ voice }) }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray) => parts.join("");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@corvo/ui-web", () => ({
  Spinner: (props: ComponentProps<"svg">) => <svg role="status" {...props} />,
  Button: ({
    variant: _variant,
    size: _size,
    ...props
  }: ComponentProps<"button"> & { variant?: string; size?: string }) => <button {...props} />,
  Field: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FieldLabel: ({ children, htmlFor }: { children?: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
  NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
}));

import { LocalSpeechSection } from "./LocalSpeechSection";

const model = (over: Partial<LocalSpeechModel> = {}): LocalSpeechModel => ({
  id: "base",
  label: "Base",
  sizeBytes: 207_557_382,
  languages: ["en", "pt"],
  state: "absent",
  bytesDone: 0,
  ...over,
});
const small = (over: Partial<LocalSpeechModel> = {}) =>
  model({ id: "small", label: "Small", sizeBytes: 639_387_718, ...over });

const credential = (over: Partial<VoiceCredential> = {}): VoiceCredential => ({
  id: "cred-1",
  provider: "local",
  hasKey: true,
  isDefault: true,
  voiceId: "",
  speechModel: "",
  transcribe: true,
  endpoint: "",
  ttsModel: "",
  sttModel: "base",
  language: "auto",
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onChanged = vi.fn(async () => undefined);

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  for (const fn of Object.values(voice)) fn.mockReset().mockResolvedValue({ ok: true });
  onChanged.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

async function show(over: { credential?: VoiceCredential } = {}) {
  await act(async () => {
    root.render(
      <LocalSpeechSection
        scope="account"
        credential={over.credential}
        disabled={false}
        onChanged={onChanged}
      />,
    );
  });
}

const row = (id: string) =>
  container.querySelector(`[data-testid="local-model-${id}"]`) as HTMLElement;
const button = (within: HTMLElement, text: string) =>
  [...within.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;

it("lists each model with its size and a Download button when none is on this computer", async () => {
  voice.localModels.mockResolvedValue([model(), small()]);
  await show();
  expect(row("base").textContent).toContain("Base");
  expect(row("base").textContent).toContain("208 MB");
  expect(row("small").textContent).toContain("639 MB");
  expect(button(row("base"), "Download")).toBeTruthy();
  expect(container.textContent).not.toContain("API key");
});

it("downloads a model, shows its progress and lets it be cancelled", async () => {
  voice.localModels
    .mockResolvedValueOnce([model(), small()])
    .mockResolvedValue([model({ state: "downloading", bytesDone: 103_778_691 }), small()]);
  await show();
  await act(async () => button(row("base"), "Download").click());
  expect(voice.downloadLocalModel).toHaveBeenCalledWith({ id: "base" });
  const progress = row("base").querySelector("progress") as HTMLProgressElement;
  expect(progress.value).toBe(103_778_691);
  expect(progress.max).toBe(207_557_382);
  await act(async () => button(row("base"), "Cancel").click());
  expect(voice.cancelLocalModelDownload).toHaveBeenCalledWith({ id: "base" });
});

it("keeps checking a download until it is ready, then offers Use", async () => {
  voice.localModels
    .mockResolvedValueOnce([model({ state: "downloading", bytesDone: 1000 }), small()])
    .mockResolvedValueOnce([model({ state: "downloading", bytesDone: 2000 }), small()])
    .mockResolvedValue([model({ state: "ready", bytesDone: 207_557_382 }), small()]);
  await show();
  expect(button(row("base"), "Cancel")).toBeTruthy();
  await act(async () => vi.advanceTimersByTimeAsync(1100));
  await act(async () => vi.advanceTimersByTimeAsync(1100));
  expect(button(row("base"), "Use")).toBeTruthy();
  const calls = voice.localModels.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(voice.localModels.mock.calls.length).toBe(calls);
});

it("uses a downloaded model with the chosen language", async () => {
  voice.localModels.mockResolvedValue([model({ state: "ready" }), small()]);
  await show();
  const select = container.querySelector("select") as HTMLSelectElement;
  await act(async () => {
    select.value = "pt";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => button(row("base"), "Use").click());
  expect(voice.connect).toHaveBeenCalledWith({
    scope: "account",
    provider: "local",
    sttModel: "base",
    language: "pt",
  });
  expect(onChanged).toHaveBeenCalled();
});

it("marks the model in use, and reconnects it when the language changes", async () => {
  voice.localModels.mockResolvedValue([model({ state: "ready" }), small({ state: "ready" })]);
  await show({ credential: credential({ sttModel: "base", language: "auto" }) });
  expect(row("base").textContent).toContain("In use");
  expect(button(row("base"), "Use")).toBeUndefined();
  expect(button(row("small"), "Use")).toBeTruthy();
  const select = container.querySelector("select") as HTMLSelectElement;
  expect(select.value).toBe("auto");
  await act(async () => {
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(voice.connect).toHaveBeenCalledWith({
    scope: "account",
    provider: "local",
    sttModel: "base",
    language: "en",
  });
});

it("removes a model and tells the screen, since the choice may have gone with it", async () => {
  voice.localModels.mockResolvedValue([model({ state: "ready" }), small()]);
  await show({ credential: credential() });
  await act(async () => button(row("base"), "Remove").click());
  expect(voice.removeLocalModel).toHaveBeenCalledWith({ id: "base" });
  expect(onChanged).toHaveBeenCalled();
});

it("shows why a download failed and offers it again", async () => {
  voice.localModels.mockResolvedValue([
    model({ state: "failed", error: "Download failed (HTTP 503)." }),
    small(),
  ]);
  await show();
  expect(row("base").textContent).toContain("Download failed (HTTP 503).");
  expect(button(row("base"), "Download")).toBeTruthy();
});

it("shows why a request failed, without losing the list", async () => {
  voice.localModels.mockResolvedValue([model(), small()]);
  voice.downloadLocalModel.mockRejectedValue(new Error("nope"));
  await show();
  await act(async () => button(row("base"), "Download").click());
  expect(container.textContent).toContain("nope");
  expect(row("small")).toBeTruthy();
});
