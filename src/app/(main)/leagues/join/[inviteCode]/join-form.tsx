"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { joinLeague } from "./actions"

const schema = z.object({
  teamName: z
    .string()
    .min(2, "Team name must be at least 2 characters")
    .max(50, "Team name must be at most 50 characters"),
})

type FormValues = z.infer<typeof schema>

interface JoinFormProps {
  inviteCode: string
  leagueName: string
}

export function JoinForm({ inviteCode, leagueName }: JoinFormProps) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormValues) => {
    setFormError(null)
    const result = await joinLeague(inviteCode, data.teamName)
    if (result.success) {
      router.push(`/leagues/${result.leagueId}`)
    } else {
      if (result.error._form) {
        setFormError(result.error._form[0])
      } else if (result.error.teamName) {
        setFormError(result.error.teamName[0])
      } else {
        setFormError("Failed to join league. Please try again.")
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="teamName" className="text-gray-700">
          Your Team Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="teamName"
          placeholder={`e.g. My ${leagueName} Team`}
          className="border-gray-200 text-gray-900 placeholder:text-gray-400"
          {...register("teamName")}
        />
        {errors.teamName && (
          <p className="text-sm text-red-600">{errors.teamName.message}</p>
        )}
      </div>

      {formError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{formError}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gray-900 text-white hover:bg-gray-700"
      >
        {isSubmitting ? "Joining..." : "Join League"}
      </Button>
    </form>
  )
}
