"use client"

import React, { memo } from "react"
import { buildDraftOrder } from "@/lib/draft-snake-order"

type Team = {
  id: number
  name: string
}

type Pick = {
  id: number
  leagueId: number
  teamId: number
  riderId: number
  pickNumber: number
  round: number
  gender: "M" | "F"
  wasAutomatic: boolean
  pickedAt: Date | string
}

// Rider info passed alongside picks for display
type RiderInfo = {
  id: number
  name: string
  team: string
}

interface DraftBoardProps {
  teams: Team[]
  picks: Pick[]
  riderMap: Map<number, RiderInfo>
  currentPickIndex: number
  draftStatus: "pending" | "men" | "women" | "complete"
  menRounds?: number
  womenRounds?: number
}

interface CellProps {
  pick: Pick | undefined
  riderMap: Map<number, RiderInfo>
  isCurrentPick: boolean
  isEmpty: boolean
}

const DraftCell = memo(function DraftCell({ pick, riderMap, isCurrentPick, isEmpty }: CellProps) {
  if (isEmpty) {
    return (
      <td
        className={`border border-gray-200 px-2 py-2 text-center text-sm min-w-[120px] ${
          isCurrentPick ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white"
        }`}
      >
        {isCurrentPick && (
          <span className="text-blue-500 font-medium text-xs">Picking...</span>
        )}
      </td>
    )
  }

  if (!pick) {
    return (
      <td className="border border-gray-200 px-2 py-2 text-center text-sm min-w-[120px] bg-gray-50">
        &mdash;
      </td>
    )
  }

  const rider = riderMap.get(pick.riderId)
  return (
    <td
      className={`border border-gray-200 px-2 py-2 text-sm min-w-[120px] ${
        pick.wasAutomatic ? "bg-orange-50" : "bg-white"
      }`}
    >
      <div className="font-medium text-gray-900 truncate max-w-[110px]">
        {pick.wasAutomatic ? (
          <span className="italic text-gray-600">{rider?.name ?? "Auto-pick"}</span>
        ) : (
          rider?.name ?? "Unknown"
        )}
      </div>
      {rider && (
        <div className="text-xs text-gray-500 truncate max-w-[110px]">{rider.team}</div>
      )}
    </td>
  )
})

export function DraftBoard({
  teams,
  picks,
  riderMap,
  currentPickIndex,
  draftStatus,
  menRounds = 18,
  womenRounds = 6,
}: DraftBoardProps) {
  if (teams.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No teams in draft.</div>
    )
  }

  // Build the draft order to know which team slot corresponds to each pick
  const draftOrder = buildDraftOrder(teams, menRounds, womenRounds)

  // Build a lookup: pickNumber -> pick
  const pickByNumber = new Map<number, Pick>()
  for (const p of picks) {
    pickByNumber.set(p.pickNumber, p)
  }

  // Build a lookup: pickNumber -> teamId from draftOrder
  const slotByNumber = new Map<number, (typeof draftOrder)[0]>()
  for (const slot of draftOrder) {
    slotByNumber.set(slot.pickNumber, slot)
  }

  const totalRounds = menRounds + womenRounds

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            {/* Round label column */}
            <th className="border border-gray-200 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-700 sticky left-0 z-10 min-w-[100px]">
              Round
            </th>
            {teams.map((t) => (
              <th
                key={t.id}
                className="border border-gray-200 bg-gray-100 px-3 py-2 text-center font-semibold text-gray-700 min-w-[120px]"
              >
                {t.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: totalRounds }, (_, roundIdx) => {
            const isMenRound = roundIdx < menRounds
            const roundLabel = isMenRound
              ? `M Round ${roundIdx + 1}`
              : `W Round ${roundIdx - menRounds + 1}`
            const isSectionDivider = roundIdx === menRounds

            return (
              <React.Fragment key={roundIdx}>
                {isSectionDivider && (
                  <tr>
                    <td
                      colSpan={teams.length + 1}
                      className="border-t-2 border-t-gray-400 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 uppercase tracking-wide"
                    >
                      Women&apos;s Draft
                    </td>
                  </tr>
                )}
                <tr>
                  <td
                    className={`border border-gray-200 px-3 py-2 font-medium text-xs sticky left-0 z-10 ${
                      isMenRound ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {roundLabel}
                  </td>
                  {teams.map((team) => {
                    // Find the slot for this round + team
                    const slot = draftOrder.find(
                      (s) => s.round === roundIdx && s.teamId === team.id
                    )

                    if (!slot) {
                      return (
                        <td
                          key={team.id}
                          className="border border-gray-200 px-2 py-2 text-center text-sm min-w-[120px] bg-gray-100 text-gray-400"
                        >
                          &mdash;
                        </td>
                      )
                    }

                    const pick = pickByNumber.get(slot.pickNumber)
                    const isCurrentPick =
                      slot.pickNumber === currentPickIndex &&
                      draftStatus !== "complete" &&
                      draftStatus !== "pending"

                    const isFuture = slot.pickNumber > currentPickIndex

                    return (
                      <DraftCell
                        key={team.id}
                        pick={pick}
                        riderMap={riderMap}
                        isCurrentPick={isCurrentPick}
                        isEmpty={!pick && isFuture}
                      />
                    )
                  })}
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
