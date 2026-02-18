export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-4">
      <div className="mb-12 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-green-blue">
          <span className="text-2xl font-bold text-white">⚡</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Velospill</h1>
          <p className="text-base text-muted-foreground">
            Professional fantasy cycling for competitive enthusiasts
          </p>
        </div>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
