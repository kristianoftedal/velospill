export default function HomePage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="space-y-8">
        {/* League CTAs Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Leagues</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-gray-600 mb-4">You haven&apos;t joined any leagues yet</p>
            <div className="flex gap-3">
              <button
                disabled
                className="px-4 py-2 rounded-md bg-gray-100 text-gray-400 text-sm font-medium cursor-not-allowed"
              >
                Create League
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-md border border-gray-200 text-gray-400 text-sm font-medium cursor-not-allowed"
              >
                Join League
              </button>
            </div>
          </div>
        </section>

        {/* Upcoming Races Section - Placeholder */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Upcoming Races</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-gray-600">
              No upcoming races. Admin can add races from the calendar.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
