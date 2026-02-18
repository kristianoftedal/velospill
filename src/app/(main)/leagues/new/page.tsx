"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLeague } from "./actions"

const schema = z.object({
  name: z
    .string()
    .min(2, "League name must be at least 2 characters")
    .max(100, "League name must be at most 100 characters"),
  teamName: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be at most 50 characters"),
  seasonYear: z
    .number()
    .int()
    .min(2024, "Year must be 2024 or later")
    .max(2030, "Year must be 2030 or earlier"),
  draftDate: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type SuccessState = {
  leagueId: number
  inviteCode: string
  inviteUrl: string
}

export default function CreateLeaguePage() {
  const router = useRouter()
  const [successState, setSuccessState] = useState<SuccessState | null>(null)
  const [copied, setCopied] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      seasonYear: new Date().getFullYear(),
    },
  })

  const onSubmit = async (data: FormValues) => {
    setFormError(null)
    const result = await createLeague(data)
    if (result.success) {
      const inviteUrl = `${window.location.origin}/leagues/join/${result.inviteCode}`
      setSuccessState({
        leagueId: result.leagueId,
        inviteCode: result.inviteCode,
        inviteUrl,
      })
    } else {
      const serverErrors = result.error as Record<string, string[]>
      if (serverErrors._form) {
        setFormError(serverErrors._form[0])
      } else {
        setFormError("Failed to create league. Please check your inputs.")
      }
    }
  }

  const handleCopyLink = async () => {
    if (!successState) return
    try {
      await navigator.clipboard.writeText(successState.inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
    }
  }

  if (successState) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-8">
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">League Created!</CardTitle>
            <CardDescription className="text-gray-600">
              Share the invite link below so others can join your league.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Invite Code</p>
              <p className="text-2xl font-mono font-bold tracking-wider text-gray-900">
                {successState.inviteCode}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Invite Link</p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={successState.inviteUrl}
                  className="text-sm text-gray-700 bg-gray-50 border-gray-200"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="whitespace-nowrap border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 pb-2">
              <Button
                onClick={() => router.push(`/leagues/${successState.leagueId}`)}
                className="w-full bg-gray-900 text-white hover:bg-gray-700"
              >
                Go to League
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/leagues/join/${successState.inviteCode}`)}
                className="w-full border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Join via Invite Link (use your own invite)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Create a New League</h1>

      <Card className="border-gray-200 bg-white">
        <CardHeader>
          <CardTitle className="text-gray-900">League Settings</CardTitle>
          <CardDescription className="text-gray-600">
            Set up your fantasy cycling league. You can invite others after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-gray-700">
                League Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. The Peloton Club"
                className="border-gray-200 text-gray-900 placeholder:text-gray-400"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="teamName" className="text-gray-700">
                Your Team Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="teamName"
                placeholder="e.g. Team Jumbo"
                className="border-gray-200 text-gray-900 placeholder:text-gray-400"
                {...register("teamName")}
              />
              {errors.teamName && (
                <p className="text-sm text-red-600">{errors.teamName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seasonYear" className="text-gray-700">
                Season Year
              </Label>
              <Input
                id="seasonYear"
                type="number"
                min={2024}
                max={2030}
                className="border-gray-200 text-gray-900"
                {...register("seasonYear", { valueAsNumber: true })}
              />
              {errors.seasonYear && (
                <p className="text-sm text-red-600">{errors.seasonYear.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="draftDate" className="text-gray-700">
                Draft Date{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="draftDate"
                type="date"
                className="border-gray-200 text-gray-900"
                {...register("draftDate")}
              />
              {errors.draftDate && (
                <p className="text-sm text-red-600">{errors.draftDate.message}</p>
              )}
            </div>

            {formError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2 pb-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gray-900 text-white hover:bg-gray-700"
              >
                {isSubmitting ? "Creating..." : "Create League"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/leagues")}
                className="border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
