"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, Users, Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserMenu } from "./user-menu"

interface AppNavProps {
  user: {
    id: string
    name: string
    email: string
  }
}

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/riders", label: "Riders", icon: Award },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/leagues", label: "Leagues", icon: Users }
]

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <>
      {/* Desktop Navigation - Top Bar */}
      <nav className="hidden md:flex h-16 bg-gradient-green-blue shadow-lg">
        <div className="container mx-auto flex items-center justify-between px-4">
          {/* Logo */}
          <Link href="/home" className="text-xl font-bold text-white hover:opacity-90 transition-opacity">
            Velospill
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <UserMenu user={user} />
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
                  isActive(item.href)
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
