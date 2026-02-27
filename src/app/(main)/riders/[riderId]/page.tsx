import { notFound } from "next/navigation"
import Link from "next/link"
import { getRiderSeasonProfile } from "@/lib/rider-queries"
import RiderProfileClient from "./rider-profile-client"

interface PageProps {
  params: Promise<{ riderId: string }>
}

export default async function RiderProfilePage({ params }: PageProps) {
  const { riderId: riderIdStr } = await params
  const riderId = parseInt(riderIdStr, 10)

  if (isNaN(riderId)) {
    notFound()
  }

  const profile = await getRiderSeasonProfile(riderId)

  if (!profile) {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/riders" className="hover:text-gray-700 hover:underline">
          Riders
        </Link>
        <span className="mx-2">&rsaquo;</span>
        <span className="text-gray-900">{profile.rider.name}</span>
      </nav>
      <RiderProfileClient profile={profile} />
    </div>
  )
}
