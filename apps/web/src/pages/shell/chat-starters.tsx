/** Tappable first messages shown while a chat is empty; each one rises in a beat after the last. */
export function ChatStarters({
  starters,
  onPick,
  align = "end",
}: {
  starters: readonly string[];
  onPick: (text: string) => void;
  /** Under an introduction the buttons centre; alone they sit by the composer. */
  align?: "end" | "center";
}) {
  if (starters.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap gap-2 pt-3 ${
        align === "center" ? "justify-center" : "mt-auto justify-end"
      }`}
    >
      {starters.map((text, index) => (
        <button
          key={text}
          type="button"
          dir="auto"
          onClick={() => onPick(text)}
          style={{ animationDelay: `${index * 45}ms` }}
          className="corvo-message-in max-w-full rounded-full border border-border bg-card px-4 py-2 text-start text-body2 text-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
