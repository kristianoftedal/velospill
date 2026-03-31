"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { Home, Calendar, Award, TrendingUp, ArrowLeftRight, ListOrdered, Swords, Cross, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserMenu } from "./user-menu"

export type NavLeague = {
  id: number
  name: string
  status: string
}

interface AppNavProps {
  user: {
    id: string
    name: string
    email: string
  }
  leagues: NavLeague[]
}

// Global nav items (shown when NOT inside a league)
const globalNavItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/riders", label: "Riders", icon: Award },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/rankings", label: "Rankings", icon: TrendingUp },
]

// League-specific nav items (shown when inside a league)
function getLeagueNavItems(leagueId: number) {
  const base = `/leagues/${leagueId}`
  return [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: `${base}/transfers`, label: "Transfers", icon: ArrowLeftRight },
    { href: `${base}/lineup`, label: "Lineup", icon: ListOrdered },
    { href: `${base}/orders`, label: "Orders", icon: Swords },
    { href: `${base}/ir`, label: "IR", icon: Cross },
    { href: `${base}/roster`, label: "Roster", icon: Users },
  ]
}

export function AppNav({ user, leagues }: AppNavProps) {
  const pathname = usePathname()

  // Detect if we're inside a league context
  const leagueMatch = pathname.match(/^\/leagues\/(\d+)/)
  const activeLeagueId = leagueMatch ? parseInt(leagueMatch[1], 10) : null
  const activeLeague = activeLeagueId != null
    ? leagues.find((l) => l.id === activeLeagueId)
    : null

  // If user has exactly one league and is on a global page, auto-context could apply
  // But we only show league nav when actually inside a league route
  const isInLeague = activeLeagueId != null && activeLeague != null && activeLeague.status === "active"

  // Persist last visited league for home page redirect
  useEffect(() => {
    if (activeLeagueId != null) {
      localStorage.setItem("velospill_last_league", String(activeLeagueId))
    }
  }, [activeLeagueId])

  const navItems = isInLeague
    ? getLeagueNavItems(activeLeagueId!)
    : globalNavItems

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <>
      {/* Desktop Navigation - Top Bar */}
      <nav className="hidden md:flex h-16 bg-gradient-green-blue shadow-lg">
        <div className="container mx-auto flex items-center justify-between px-4">
          {/* Logo + league context */}
          <div className="flex items-center gap-3">
            <Link href="/home" className="text-xl font-bold text-white hover:opacity-90 transition-opacity">
              Velospill
            </Link>
            {isInLeague && activeLeague && (
              <>
                <span className="text-white/40">/</span>
                <span className="text-sm font-medium text-white/80 truncate max-w-[160px]">
                  {activeLeague.name}
                </span>
              </>
            )}
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(item.href, (item as any).exact)
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <UserMenu user={user} leagues={leagues} activeLeagueId={activeLeagueId} />
        </div>
      </nav>

      {/* Mobile Navigation - Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-gradient-green-blue shadow-lg">
        <div className="flex h-full items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                  isActive(item.href, (item as any).exact)
                    ? "text-white"
                    : "text-white/60 hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
