import { z } from "zod"

const BOT_TYPES = ["rsi", "sma-crossover", "momentum", "mean-reversion", "custom"] as const

export const importBotSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(BOT_TYPES),
  params: z.record(z.string(), z.number()),
  emoji: z.string().optional(),
  color: z.string().optional(),
})

export const updateBotParamsSchema = z.object({
  params: z.record(z.string(), z.number()).refine(
    (p) => Object.keys(p).length > 0,
    { message: "params must have at least one key" }
  ),
})

export type ImportBotInput = z.infer<typeof importBotSchema>
export type UpdateBotParamsInput = z.infer<typeof updateBotParamsSchema>
