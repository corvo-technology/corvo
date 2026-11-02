import { z } from "zod";

/** What a person can tap to start an empty chat; at most four short messages. */
export const BotStartersSchema = z.array(z.string().trim().min(1).max(120)).max(4);
export type BotStarters = z.infer<typeof BotStartersSchema>;
