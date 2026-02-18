/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { createRider, updateRider } from "@/app/admin/riders/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const riderSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  team: z.string().min(1, "Team is required"),
  nationality: z
    .string()
    .length(3, "Use 3-letter country code (e.g., NOR, FRA)"),
  gender: z.enum(["M", "F"]),
});

type RiderFormData = z.infer<typeof riderSchema>;

interface RiderFormProps {
  initialData?: {
    id: number;
    name: string;
    team: string;
    nationality: string;
    gender: "M" | "F";
  };
  onSuccess?: () => void;
}

export function RiderForm({ initialData, onSuccess }: RiderFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<RiderFormData>({
    resolver: zodResolver(riderSchema),
    defaultValues: {
      name: initialData?.name || "",
      team: initialData?.team || "",
      nationality: initialData?.nationality || "",
      gender: initialData?.gender || "M",
    },
  });

  const onSubmit = async (data: RiderFormData) => {
    setIsSubmitting(true);
    setError(null);

    const result = initialData
      ? await updateRider(initialData.id, data)
      : await createRider(data);

    setIsSubmitting(false);

    if (result.success) {
      form.reset();
      onSuccess?.();
    } else {
      if (
        typeof result.error === "object" &&
        result.error &&
        "_form" in result.error
      ) {
        setError((result.error as any)._form[0] || "Failed to save rider");
      } else {
        setError("Failed to save rider");
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Tadej Pogacar" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="team"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team</FormLabel>
              <FormControl>
                <Input placeholder="UAE Team Emirates" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nationality"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nationality</FormLabel>
              <FormControl>
                <Input placeholder="SVN" maxLength={3} {...field} />
              </FormControl>
              <FormDescription>
                3-letter country code (e.g., NOR, FRA)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : initialData
                ? "Save Changes"
                : "Add Rider"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
