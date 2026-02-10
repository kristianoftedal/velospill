"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { importRaces } from "@/app/admin/races/actions"
import Papa from "papaparse"

interface RaceCSVImportProps {
  onSuccess?: () => void
}

type CSVRow = {
  name: string
  race_type: string
  start_date: string
  end_date?: string
  season: string
  parent_race_name?: string
  stage_number?: string
}

export function RaceCSVImport({ onSuccess }: RaceCSVImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVRow[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    imported: number
    errors: Array<{ row: number; field: string; message: string }>
  } | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    // Parse CSV for preview
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data.slice(0, 5) as CSVRow[])
      },
    })
  }

  async function handleImport() {
    if (!file) return

    setIsUploading(true)
    setResult(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const importResult = await importRaces(results.data as CSVRow[])
        setResult(importResult)
        setIsUploading(false)

        if (importResult.success) {
          setFile(null)
          setPreview([])
          onSuccess?.()
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Import Races from CSV</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file with race data. Format depends on import type:
        </p>

        <div className="space-y-3 text-xs text-muted-foreground bg-gray-50 p-3 rounded-md mb-4">
          <div>
            <strong>Parent Races CSV:</strong>
            <pre className="mt-1 font-mono">
name,race_type,start_date,end_date,season{"\n"}
Giro d'Italia,grand_tour,2026-05-09,2026-05-31,2026{"\n"}
Milano-San Remo,high_priority_one_day,2026-03-21,,2026
            </pre>
          </div>

          <div>
            <strong>Stages CSV (requires parent race to exist first):</strong>
            <pre className="mt-1 font-mono">
parent_race_name,stage_number,name,start_date{"\n"}
Giro d'Italia,1,Stage 1,2026-05-09{"\n"}
Giro d'Italia,2,Stage 2,2026-05-10
            </pre>
          </div>

          <p className="mt-2">
            <strong>Race types:</strong> grand_tour, high_priority_one_day, low_priority_one_day,
            mini_tour, womens_grand_tour, womens_one_day, world_championship
          </p>
        </div>

        <Input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>

      {preview.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">
            Preview (first 5 rows):
          </h4>
          <div className="rounded-md border overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(preview[0]).map((key) => (
                    <th
                      key={key}
                      className="px-4 py-2 text-left font-medium text-gray-700"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t">
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="px-4 py-2">
                        {value || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              onClick={() => {
                setFile(null)
                setPreview([])
              }}
              variant="outline"
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isUploading}>
              {isUploading ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          <AlertDescription>
            {result.success ? (
              <p>Successfully imported {result.imported} race(s)</p>
            ) : (
              <div>
                <p className="font-semibold mb-2">
                  Imported {result.imported} race(s), but {result.errors.length}{" "}
                  error(s) occurred:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>
                      Row {err.row}, {err.field}: {err.message}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>...and {result.errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
