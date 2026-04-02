import { describe, it, expect } from "vitest"
import { resolveConflicts } from "./transfer-queries"

// Helper to create a bid
function bid(
  bidId: number,
  teamId: number,
  inRiderId: number,
  bidAmount: number,
  submittedAt: string = "2026-03-01T12:00:00Z"
) {
  return { bidId, teamId, inRiderId, bidAmount, submittedAt: new Date(submittedAt) }
}

function standings(entries: Array<[teamId: number, totalPoints: number]>) {
  return new Map(entries)
}

describe("resolveConflicts", () => {
  // ─── No conflicts ───────────────────────────────────────────────────

  it("returns empty when no bids", () => {
    const result = resolveConflicts([], standings([]))
    expect(result.winningBids).toEqual([])
    expect(result.rejectedBids).toEqual([])
  })

  it("single bid for a rider wins uncontested", () => {
    const bids = [bid(1, 10, 100, 5)]
    const result = resolveConflicts(bids, standings([[10, 50]]))

    expect(result.winningBids).toHaveLength(1)
    expect(result.winningBids[0]).toEqual({ bidId: 1, teamId: 10, priority: 1 })
    expect(result.rejectedBids).toHaveLength(0)
  })

  it("bids for different riders don't conflict — both win", () => {
    const bids = [
      bid(1, 10, 100, 5),
      bid(2, 20, 200, 3),
    ]
    const result = resolveConflicts(bids, standings([[10, 50], [20, 30]]))

    expect(result.winningBids).toHaveLength(2)
    expect(result.rejectedBids).toHaveLength(0)
    const winnerIds = result.winningBids.map((w) => w.bidId).sort()
    expect(winnerIds).toEqual([1, 2])
  })

  // ─── Bid amount wins ───────────────────────────────────────────────

  it("higher bid amount wins over lower", () => {
    const bids = [
      bid(1, 10, 100, 3),  // team 10 bids 3
      bid(2, 20, 100, 7),  // team 20 bids 7
    ]
    const result = resolveConflicts(bids, standings([[10, 50], [20, 50]]))

    expect(result.winningBids).toHaveLength(1)
    expect(result.winningBids[0].bidId).toBe(2)
    expect(result.winningBids[0].teamId).toBe(20)

    expect(result.rejectedBids).toHaveLength(1)
    expect(result.rejectedBids[0].bidId).toBe(1)
  })

  it("bid amount is primary — beats better waiver priority", () => {
    const bids = [
      bid(1, 10, 100, 10), // team 10 has more points (worse priority) but higher bid
      bid(2, 20, 100, 5),  // team 20 has fewer points (better priority) but lower bid
    ]
    // Team 20 has fewer points = better waiver priority
    const result = resolveConflicts(bids, standings([[10, 100], [20, 10]]))

    // Team 10 wins because bid amount is 10 vs 5
    expect(result.winningBids[0].bidId).toBe(1)
    expect(result.winningBids[0].teamId).toBe(10)
    expect(result.rejectedBids[0].bidId).toBe(2)
  })

  // ─── Waiver wire tiebreaker (same bid amount) ─────────────────────

  it("equal bid amount: team with fewer points wins (waiver wire)", () => {
    const bids = [
      bid(1, 10, 100, 5),
      bid(2, 20, 100, 5),
    ]
    // Team 20 has 30 points (fewer) → higher waiver priority
    const result = resolveConflicts(bids, standings([[10, 80], [20, 30]]))

    expect(result.winningBids[0].bidId).toBe(2)
    expect(result.winningBids[0].teamId).toBe(20)
    expect(result.rejectedBids[0].bidId).toBe(1)
  })

  it("waiver priority: last place team beats first place team on equal bid", () => {
    const bids = [
      bid(1, 10, 100, 0), // first place team, free bid
      bid(2, 20, 100, 0), // last place team, free bid
      bid(3, 30, 100, 0), // middle team, free bid
    ]
    const result = resolveConflicts(
      bids,
      standings([[10, 200], [20, 10], [30, 100]])
    )

    // Team 20 (10 points, last place) wins
    expect(result.winningBids[0].bidId).toBe(2)
    expect(result.winningBids[0].teamId).toBe(20)

    // Other two rejected
    expect(result.rejectedBids).toHaveLength(2)
    const rejectedIds = result.rejectedBids.map((r) => r.bidId).sort()
    expect(rejectedIds).toEqual([1, 3])
  })

  // ─── Submission time tiebreaker ───────────────────────────────────

  it("equal bid + equal points: earlier submission wins", () => {
    const bids = [
      bid(1, 10, 100, 5, "2026-03-01T14:00:00Z"), // later
      bid(2, 20, 100, 5, "2026-03-01T10:00:00Z"), // earlier
    ]
    const result = resolveConflicts(bids, standings([[10, 50], [20, 50]]))

    expect(result.winningBids[0].bidId).toBe(2) // earlier submission wins
    expect(result.rejectedBids[0].bidId).toBe(1)
  })

  // ─── Multiple riders contested simultaneously ─────────────────────

  it("resolves multiple contested riders independently", () => {
    const bids = [
      // Rider 100: team 10 bids more
      bid(1, 10, 100, 10),
      bid(2, 20, 100, 5),
      // Rider 200: team 20 bids more
      bid(3, 10, 200, 3),
      bid(4, 20, 200, 8),
    ]
    const result = resolveConflicts(bids, standings([[10, 50], [20, 50]]))

    expect(result.winningBids).toHaveLength(2)
    expect(result.rejectedBids).toHaveLength(2)

    // Team 10 wins rider 100 (bid 10 > 5)
    const winner100 = result.winningBids.find((w) => w.bidId === 1)
    expect(winner100).toBeDefined()
    expect(winner100!.teamId).toBe(10)

    // Team 20 wins rider 200 (bid 8 > 3)
    const winner200 = result.winningBids.find((w) => w.bidId === 4)
    expect(winner200).toBeDefined()
    expect(winner200!.teamId).toBe(20)
  })

  // ─── Three-way conflict ───────────────────────────────────────────

  it("three teams bid for same rider: highest amount wins, two rejected", () => {
    const bids = [
      bid(1, 10, 100, 5),
      bid(2, 20, 100, 8),
      bid(3, 30, 100, 3),
    ]
    const result = resolveConflicts(
      bids,
      standings([[10, 50], [20, 50], [30, 50]])
    )

    expect(result.winningBids).toHaveLength(1)
    expect(result.winningBids[0].bidId).toBe(2) // highest bid
    expect(result.rejectedBids).toHaveLength(2)
  })

  it("three-way tie on bid amount: worst-ranked team wins", () => {
    const bids = [
      bid(1, 10, 100, 5),
      bid(2, 20, 100, 5),
      bid(3, 30, 100, 5),
    ]
    const result = resolveConflicts(
      bids,
      standings([[10, 100], [20, 200], [30, 50]])
    )

    // Team 30 has 50 points (fewest) → wins
    expect(result.winningBids[0].bidId).toBe(3)
    expect(result.winningBids[0].teamId).toBe(30)
    expect(result.rejectedBids).toHaveLength(2)
  })

  // ─── Edge cases ───────────────────────────────────────────────────

  it("team with no standings data gets 0 points (best waiver priority)", () => {
    const bids = [
      bid(1, 10, 100, 5),
      bid(2, 20, 100, 5),
    ]
    // Team 20 not in standings → 0 points → best priority
    const result = resolveConflicts(bids, standings([[10, 50]]))

    expect(result.winningBids[0].bidId).toBe(2)
    expect(result.winningBids[0].teamId).toBe(20)
  })

  it("null submittedAt treated as epoch 0 (earliest possible)", () => {
    const bids = [
      { bidId: 1, teamId: 10, inRiderId: 100, bidAmount: 5, submittedAt: null },
      bid(2, 20, 100, 5, "2026-03-01T12:00:00Z"),
    ]
    // Same bid, same points → null submittedAt = time 0 = earliest → wins
    const result = resolveConflicts(bids, standings([[10, 50], [20, 50]]))

    expect(result.winningBids[0].bidId).toBe(1)
  })

  it("same team bidding twice for the same rider — first bid wins on time", () => {
    const bids = [
      bid(1, 10, 100, 5, "2026-03-01T08:00:00Z"),
      bid(2, 10, 100, 5, "2026-03-01T12:00:00Z"),
    ]
    const result = resolveConflicts(bids, standings([[10, 50]]))

    expect(result.winningBids[0].bidId).toBe(1)
    expect(result.rejectedBids[0].bidId).toBe(2)
  })

  // ─── Priority ordering of winners ─────────────────────────────────

  it("winning bids are assigned sequential priority numbers", () => {
    const bids = [
      bid(1, 10, 100, 5),
      bid(2, 20, 200, 5),
      bid(3, 30, 300, 5),
    ]
    const result = resolveConflicts(
      bids,
      standings([[10, 50], [20, 50], [30, 50]])
    )

    expect(result.winningBids).toHaveLength(3)
    const priorities = result.winningBids.map((w) => w.priority).sort()
    expect(priorities).toEqual([1, 2, 3])
  })

  // ─── Mixed contested and uncontested ──────────────────────────────

  it("mix of contested and uncontested bids", () => {
    const bids = [
      bid(1, 10, 100, 5),  // uncontested for rider 100
      bid(2, 20, 200, 3),  // contested for rider 200
      bid(3, 30, 200, 7),  // contested for rider 200
      bid(4, 40, 300, 1),  // uncontested for rider 300
    ]
    const result = resolveConflicts(
      bids,
      standings([[10, 50], [20, 50], [30, 50], [40, 50]])
    )

    expect(result.winningBids).toHaveLength(3) // one winner per rider
    expect(result.rejectedBids).toHaveLength(1) // team 20 loses rider 200

    const winnerRider200 = result.winningBids.find((w) => w.bidId === 3)
    expect(winnerRider200).toBeDefined()
    expect(winnerRider200!.teamId).toBe(30) // bid 7 > 3

    expect(result.rejectedBids[0].bidId).toBe(2)
  })

  // ─── Zero-amount bids (free pickups) ──────────────────────────────

  it("zero-amount bids resolved purely by waiver priority", () => {
    const bids = [
      bid(1, 10, 100, 0),
      bid(2, 20, 100, 0),
    ]
    // Team 20 has fewer points → wins
    const result = resolveConflicts(bids, standings([[10, 100], [20, 20]]))

    expect(result.winningBids[0].teamId).toBe(20)
  })
})
