import type { MascotMood } from "@corvo/core";
import type { MountedAvatar } from "open-bot-avatar/dom";
import { mountAvatar } from "open-bot-avatar/dom";
import { useEffect, useRef } from "react";
import type { BotCharacter } from "./bot-characters.js";

/**
 * From this size on a character is alive: it moves, blinks, looks at the pointer and turns to it.
 * Smaller ones, in lists, are a still picture, so a long roster does not run dozens of scenes.
 */
export const LIVELY_FROM = 56;

type CharacterMood = "idle" | "thinking" | "happy";

/** What the character shows for what the mascot would: thinking at work, a smile when done. */
export function characterMood(mood: MascotMood): CharacterMood {
  return mood === "thinking" ? "thinking" : mood === "happy" ? "happy" : "idle";
}

/**
 * A character of Open Bot Avatar in an agent's color, drawn by the project's own renderer into
 * the box it is given. It is mounted once, and a change of color or mood only redraws what changed.
 */
export function CharacterAvatar({
  character,
  color,
  eyeColor,
  mood,
  size,
}: {
  character: BotCharacter;
  color: string;
  eyeColor: string;
  mood: MascotMood;
  size: number;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const mounted = useRef<MountedAvatar | null>(null);
  const live = size >= LIVELY_FROM;
  const shown = characterMood(mood);
  const latest = useRef({ color, eyeColor, mood: shown });
  latest.current = { color, eyeColor, mood: shown };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const avatar = mountAvatar(element, {
      definition: character.definition,
      ...latest.current,
      still: !live,
      followPointer: live,
      // The agent's name is shown beside it.
      label: "",
    });
    mounted.current = avatar;
    return () => {
      avatar.destroy();
      mounted.current = null;
    };
  }, [character, live]);

  useEffect(() => {
    mounted.current?.update({ color, eyeColor, mood: shown });
  }, [color, eyeColor, shown]);

  return (
    <span
      ref={host}
      aria-hidden="true"
      className="corvo-character block"
      style={{ width: size, height: size }}
    />
  );
}
