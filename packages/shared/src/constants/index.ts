export const TICKET_RATE_LIMIT = {
  maxPerMinute: 1,
  windowMs: 60_000,
} as const

export const TRANSCRIPT_RETENTION = {
  free: 1 * 24 * 60 * 60 * 1000, // 1 day in ms
  premium: Infinity,
} as const

export const PREMIUM_PRICE = {
  base: 800, // $8.00 in cents
  additionalServer: 300, // $3.00 in cents
  includedServers: 3,
} as const
