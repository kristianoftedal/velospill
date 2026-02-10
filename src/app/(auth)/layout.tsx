export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Velospill</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fantasy cycling for enthusiasts
        </p>
      </div>
      {children}
    </div>
  )
}
