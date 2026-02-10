"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, Users } from "lucide-react"
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
      <nav className="hidden md:flex h-16 border-b border-gray-200 bg-white">
        <div className="container mx-auto flex items-center justify-between px-4">
          {/* Logo */}
          <Link href="/home" className="text-xl font-bold text-gray-900 hover:text-gray-700 transition-colors">
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
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-gray-200 bg-white">
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
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-900"
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
