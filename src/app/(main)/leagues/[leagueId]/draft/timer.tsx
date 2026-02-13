"use client"

import { useEffect, useState } from "react"

interface DraftTimerProps {
  expiresAt: Date | null
  isMyTurn: boolean
}

export function DraftTimer({ expiresAt, isMyTurn }: DraftTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0)
      return
    }

    // Initial calculation
    const computeSeconds = () =>
      Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

    setSecondsLeft(computeSeconds())

    const interval = setInterval(() => {
      setSecondsLeft(computeSeconds())
    }, 500)

    return () => clearInterval(interval)
  }, [expiresAt])

  if (!expiresAt) {
    return null
  }

  const isUrgent = secondsLeft <= 10
  const isCritical = secondsLeft <= 5

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
        {isMyTurn ? "Your time" : "Time remaining"}
      </p>
      <div
        className={`flex items-center justify-center rounded-lg px-4 py-2 transition-all ${
          isCritical
            ? "bg-red-600 text-white animate-pulse min-w-[80px]"
            : isUrgent
            ? "bg-red-50 text-red-600 animate-pulse min-w-[70px]"
            : "bg-gray-100 text-gray-800 min-w-[70px]"
        }`}
      >
        <span
          className={`font-bold tabular-nums ${
            isCritical ? "text-5xl" : isUrgent ? "text-4xl" : "text-4xl"
          }`}
        >
          {secondsLeft}s
        </span>
      </div>
    </div>
  )
}
