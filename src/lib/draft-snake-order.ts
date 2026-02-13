export type DraftSlot = {
  pickNumber: number
  round: number
  gender: 'M' | 'F'
  teamId: number
  teamIndex: number
}

/**
 * Returns the team index (0-based) for a given pick index in a snake draft.
 * Even rounds go left-to-right (0, 1, 2, ..., n-1).
 * Odd rounds go right-to-left (n-1, n-2, ..., 0).
 */
export function getTeamIndexForPick(pickIndex: number, teamCount: number): number {
  const round = Math.floor(pickIndex / teamCount)
  const positionInRound = pickIndex % teamCount
  return round % 2 === 0 ? positionInRound : (teamCount - 1 - positionInRound)
}

/**
 * Builds the full draft order for a snake draft.
 * Men's rounds come first, then women's rounds.
 * pickNumber increments globally across both genders.
 */
export function buildDraftOrder(
  teams: { id: number; name: string }[],
  menRounds: number,
  womenRounds: number
): DraftSlot[] {
  const slots: DraftSlot[] = []
  const teamCount = teams.length
  let pickNumber = 0

  // Men's rounds (0 to menRounds-1)
  for (let round = 0; round < menRounds; round++) {
    for (let pos = 0; pos < teamCount; pos++) {
      const pickIndex = round * teamCount + pos
      const teamIndex = getTeamIndexForPick(pickIndex, teamCount)
      slots.push({
        pickNumber,
        round,
        gender: 'M',
        teamId: teams[teamIndex].id,
        teamIndex
      })
      pickNumber++
    }
  }

  // Women's rounds (menRounds to menRounds+womenRounds-1)
  for (let round = 0; round < womenRounds; round++) {
    const absoluteRound = menRounds + round
    for (let pos = 0; pos < teamCount; pos++) {
      // The snake for women's rounds is independent — starts fresh from round 0
      const pickIndex = round * teamCount + pos
      const teamIndex = getTeamIndexForPick(pickIndex, teamCount)
      slots.push({
        pickNumber,
        round: absoluteRound,
        gender: 'F',
        teamId: teams[teamIndex].id,
        teamIndex
      })
      pickNumber++
    }
  }

  return slots
}

/**
 * Returns the total number of picks in a draft.
 */
export function getTotalPicks(teamCount: number, menRounds: number, womenRounds: number): number {
  return teamCount * (menRounds + womenRounds)
}

/**
 * Computes the next draft state after a pick at currentPickIndex.
 * Pure math — safe for client-side use.
 */
export function computeNextDraftState(
  currentPickIndex: number,
  teamCount: number,
  menRounds: number,
  womenRounds: number
) {
  const nextPickIndex = currentPickIndex + 1
  const menTotalPicks = teamCount * menRounds
  const totalPicks = teamCount * (menRounds + womenRounds)

  const isComplete = nextPickIndex >= totalPicks
  const isMenComplete = nextPickIndex >= menTotalPicks

  const nextGender: 'M' | 'F' = isMenComplete ? 'F' : 'M'

  let nextRound: number
  let nextTeamIndex: number

  if (!isMenComplete) {
    nextRound = Math.floor(nextPickIndex / teamCount)
    nextTeamIndex = getTeamIndexForPick(nextPickIndex, teamCount)
  } else {
    const womenPickIndex = nextPickIndex - menTotalPicks
    nextRound = menRounds + Math.floor(womenPickIndex / teamCount)
    nextTeamIndex = getTeamIndexForPick(womenPickIndex, teamCount)
  }

  return {
    nextPickIndex,
    nextRound,
    nextGender,
    nextTeamIndex,
    isComplete,
    isMenComplete,
  }
}
