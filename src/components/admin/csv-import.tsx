"use client";

import { importRiders } from "@/app/admin/riders/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";

interface CSVImportProps {
  onSuccess?: () => void;
}

export function CSVImport({ onSuccess }: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported?: number;
    errors?: { row: number; errors: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data.slice(0, 5));
      },
      error: (error) => {
        console.error("CSV parse error:", error);
      },
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const importResult = await importRiders(results.data);
        setResult(importResult);
        setIsImporting(false);

        if (importResult.success) {
          setFile(null);
          setPreview([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setTimeout(() => {
            onSuccess?.();
          }, 1500);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Expected CSV format:</p>
          <code className="block bg-muted p-2 rounded text-xs">
            name,team,nationality,gender
            <br />
            Tadej Pogacar,UAE Team Emirates,SVN,M,gc
            <br />
            Wout van Aert,Team Visma-Lease a Bike,BEL,M,allrounder
          </code>
        </div>

        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="flex-1"
          />
          <Button
            onClick={handleImport}
            disabled={!file || isImporting}
            className="w-24"
          >
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            Preview (showing first {preview.length} rows)
          </h4>
          <div className="border rounded-md max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Gender</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.team}</TableCell>
                    <TableCell>{row.nationality}</TableCell>
                    <TableCell>{row.gender}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          {result.success ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">
                Import Successful
              </AlertTitle>
              <AlertDescription className="text-green-700">
                Successfully imported {result.imported} riders.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Failed</AlertTitle>
              <AlertDescription>
                <div className="space-y-1 mt-2">
                  {result.errors?.map((error, index) => (
                    <div key={index} className="text-sm">
                      <strong>Row {error.row}:</strong> {error.errors}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
