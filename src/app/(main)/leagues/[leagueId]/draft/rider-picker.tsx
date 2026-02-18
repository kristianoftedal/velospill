"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type Rider = {
  id: number;
  name: string;
  team: string;
  nationality: string;
  gender: "M" | "F";
};

interface RiderPickerProps {
  availableRiders: Rider[];
  isMyTurn: boolean;
  onPick: (riderId: number) => void;
  isPickPending: boolean;
  currentGender: "M" | "F";
  currentDrafterName?: string;
}

export function RiderPicker({
  availableRiders,
  isMyTurn,
  onPick,
  isPickPending,
  currentGender,
  currentDrafterName,
}: RiderPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handlePick = (riderId: number) => {
    onPick(riderId);
    setSearchQuery("");
  };

  // Client-side filtering
  const filteredRiders = useMemo(() => {
    return availableRiders.filter((rider) => {
      const matchesSearch =
        searchQuery === "" ||
        rider.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [availableRiders, searchQuery]);

  const genderLabel = currentGender === "M" ? "Men's Riders" : "Women's Riders";

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{genderLabel}</CardTitle>
        <p className="text-xs text-gray-500">
          {availableRiders.length} riders available
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Not my turn overlay message */}
        {!isMyTurn && currentDrafterName && (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 text-center">
            Waiting for{" "}
            <span className="font-medium text-gray-700">
              {currentDrafterName}
            </span>
            &apos;s pick...
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search riders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        {/* Result count */}
        {searchQuery && (
          <p className="text-xs text-gray-400">
            {filteredRiders.length} of {availableRiders.length} riders shown
          </p>
        )}

        {/* Rider list */}
        <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
          {availableRiders.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6 space-y-2">
              <p className="font-medium">No riders in the database</p>
              <p className="text-xs">
                An admin needs to import riders via the{" "}
                <a
                  href="/admin/riders"
                  className="text-blue-600 hover:underline"
                >
                  Admin Riders
                </a>{" "}
                page before the draft can work.
              </p>
            </div>
          ) : filteredRiders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No riders match your filters.
            </p>
          ) : (
            filteredRiders.map((rider) => (
              <div
                key={rider.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {rider.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {rider.team} &middot; {rider.nationality}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant={isMyTurn ? "default" : "outline"}
                    disabled={!isMyTurn || isPickPending}
                    onClick={() => handlePick(rider.id)}
                    className="text-xs px-2 py-1 h-auto"
                  >
                    {isPickPending ? "..." : "Pick"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
