"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"

type Race = {
  id: number
  name: string
  raceType: string
  startDate: Date
  endDate: Date | null
  season: number
  stageCount: number
}

const raceTypeColors: Record<string, string> = {
  grand_tour: "bg-purple-100 text-purple-800 border-purple-200",
  high_priority_one_day: "bg-red-100 text-red-800 border-red-200",
  low_priority_one_day: "bg-orange-100 text-orange-800 border-orange-200",
  mini_tour: "bg-blue-100 text-blue-800 border-blue-200",
  womens_grand_tour: "bg-pink-100 text-pink-800 border-pink-200",
  womens_one_day: "bg-rose-100 text-rose-800 border-rose-200",
  world_championship: "bg-yellow-100 text-yellow-800 border-yellow-200",
}

const raceTypeLabels: Record<string, string> = {
  grand_tour: "Grand Tour (Men)",
  high_priority_one_day: "High Priority One-Day",
  low_priority_one_day: "Low Priority One-Day",
  mini_tour: "Mini Tour",
  womens_grand_tour: "Women's Grand Tour",
  womens_one_day: "Women's One-Day",
  world_championship: "World Championship",
}

export const columns = (
  onEdit: (race: Race) => void,
  onDelete: (race: Race) => void,
  onManageStages: (race: Race) => void
): ColumnDef<Race>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
  },
  {
    accessorKey: "raceType",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("raceType") as string
      return (
        <Badge variant="outline" className={raceTypeColors[type] || ""}>
          {raceTypeLabels[type] || type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "startDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Start Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const date = row.getValue("startDate") as Date
      return format(new Date(date), "MMM d, yyyy")
    },
  },
  {
    accessorKey: "endDate",
    header: "End Date",
    cell: ({ row }) => {
      const date = row.getValue("endDate") as Date | null
      return date ? format(new Date(date), "MMM d, yyyy") : "—"
    },
  },
  {
    accessorKey: "season",
    header: "Season",
    cell: ({ row }) => <div>{row.getValue("season")}</div>,
  },
  {
    accessorKey: "stageCount",
    header: "Stages",
    cell: ({ row }) => {
      const count = row.getValue("stageCount") as number
      const raceType = row.getValue("raceType") as string
      const isMultiStage = ["grand_tour", "mini_tour", "womens_grand_tour"].includes(
        raceType
      )

      if (!isMultiStage) {
        return "—"
      }

      return <div className="text-muted-foreground">{count || 0}</div>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const race = row.original
      const raceType = race.raceType
      const isMultiStage = ["grand_tour", "mini_tour", "womens_grand_tour"].includes(
        raceType
      )

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(race)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {isMultiStage && (
              <DropdownMenuItem onClick={() => onManageStages(race)}>
                <List className="mr-2 h-4 w-4" />
                Manage Stages
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onDelete(race)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
