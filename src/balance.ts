/**
 * Difficulty presets — the single place to tune the economy per difficulty.
 *
 * - costMul:   multiplier for every unlock pad price
 * - incomeMul: multiplier for item sale prices, truck bonuses, train payouts, goal rewards
 * - regenMul:  multiplier for field regrow time (< 1 = crops grow back faster)
 * - goalMul:   multiplier for goal targets (how many items to sell)
 */
export type Difficulty = 'easy' | 'normal' | 'hard'

export type DifficultyPreset = {
  label: string
  description: string
  costMul: number
  incomeMul: number
  regenMul: number
  goalMul: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyPreset> = {
  easy: {
    label: 'Easy',
    description: 'Cheaper unlocks, higher prices, fast crops',
    costMul: 0.65,
    incomeMul: 1.35,
    regenMul: 0.75,
    goalMul: 0.75,
  },
  normal: {
    label: 'Normal',
    description: 'The original balance',
    costMul: 1,
    incomeMul: 1,
    regenMul: 1,
    goalMul: 1,
  },
  hard: {
    label: 'Hard',
    description: 'Pricier unlocks, lower prices, slow crops',
    costMul: 1.5,
    incomeMul: 0.8,
    regenMul: 1.3,
    goalMul: 1.3,
  },
}

export const DEFAULT_DIFFICULTY: Difficulty = 'normal'

export function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'normal' || v === 'hard'
}

/**
 * Truck orders: cargo is paid at TRUCK_PREMIUM x its shop value, plus a delivery bonus,
 * straight into the wallet. At 1.0 trucks felt worse than the counter (payout only after
 * 40 jars, slow loading, cash dropped far away at shop 1).
 */
export const TRUCK_PREMIUM = 1.5
/** Seconds per item when the player loads a truck by hand. */
export const TRUCK_LOAD_INTERVAL = 0.06

/** Max jars one jar loader carries per trip. */
export const JAR_LOADER_CAPACITY = 16
