"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";

type RecapRider = {
  name: string;
  team: string;
  nationality: string;
};

type EnrichedPick = {
  id: number;
  teamId: number;
  riderId: number;
  pickNumber: number;
  round: number;
  gender: "M" | "F";
  wasAutomatic: boolean;
  rider: RecapRider | null;
};

type RecapTeam = {
  id: number;
  name: string;
  userName: string;
};

interface DraftRecapProps {
  teams: RecapTeam[];
  picks: EnrichedPick[];
  leagueId: number;
  isOwner: boolean;
}

export function DraftRecap({ teams, picks, leagueId, isOwner }: DraftRecapProps) {
  // Group picks by teamId
  const picksByTeam = new Map<number, EnrichedPick[]>();
  for (const team of teams) {
    picksByTeam.set(team.id, []);
  }
  for (const pick of picks) {
    const teamPicks = picksByTeam.get(pick.teamId);
    if (teamPicks) {
      teamPicks.push(pick);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <h1 className="text-4xl font-bold text-gray-900">
              Draft Complete!
            </h1>
            <Trophy className="h-10 w-10 text-yellow-500" />
          </div>
          <p className="text-gray-500 text-lg">
            All picks have been made. Here are the final rosters.
          </p>
        </div>

        {/* Team grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {teams.map((team) => {
            const teamPicks = picksByTeam.get(team.id) ?? [];
            const menPicks = teamPicks
              .filter((p) => p.gender === "M")
              .sort((a, b) => a.pickNumber - b.pickNumber);
            const womenPicks = teamPicks
              .filter((p) => p.gender === "F")
              .sort((a, b) => a.pickNumber - b.pickNumber);

            return (
              <Card key={team.id} className="overflow-hidden">
                <CardHeader className="bg-gray-900 text-white pb-4">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <CardDescription className="text-gray-300 text-sm">
                    {team.userName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Men's section */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Men&apos;s Riders ({menPicks.length})
                      </span>
                    </div>
                    <ol className="space-y-1">
                      {menPicks.map((pick, idx) => (
                        <li
                          key={pick.id}
                          className={`flex items-start gap-2 py-1.5 px-2 rounded text-sm ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <span className="text-gray-400 text-xs w-5 flex-shrink-0 mt-0.5">
                            {pick.pickNumber + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            {pick.rider ? (
                              <>
                                <span
                                  className={`font-medium text-gray-900 ${
                                    pick.wasAutomatic ? "italic" : ""
                                  }`}
                                >
                                  {pick.rider.name}
                                  {pick.wasAutomatic && (
                                    <span className="ml-1 text-xs text-gray-500 font-normal">
                                      (auto)
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-xs text-gray-500 truncate">
                                    {pick.rider.team}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span className="italic text-gray-400">
                                Unknown rider
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="border-t border-gray-200 mx-4 my-2" />

                  {/* Women's section */}
                  <div className="px-4 pb-4 pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                        Women&apos;s Riders ({womenPicks.length})
                      </span>
                    </div>
                    <ol className="space-y-1">
                      {womenPicks.map((pick, idx) => (
                        <li
                          key={pick.id}
                          className={`flex items-start gap-2 py-1.5 px-2 rounded text-sm ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <span className="text-gray-400 text-xs w-5 flex-shrink-0 mt-0.5">
                            {pick.pickNumber + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            {pick.rider ? (
                              <>
                                <span
                                  className={`font-medium text-gray-900 ${
                                    pick.wasAutomatic ? "italic" : ""
                                  }`}
                                >
                                  {pick.rider.name}
                                  {pick.wasAutomatic && (
                                    <span className="ml-1 text-xs text-gray-500 font-normal">
                                      (auto)
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-xs text-gray-500 truncate">
                                    {pick.rider.team}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span className="italic text-gray-400">
                                Unknown rider
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center space-y-4">
          <Link
            href={`/leagues/${leagueId}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
          >
            Go to League
            <ArrowRight className="h-4 w-4" />
          </Link>
          {isOwner && (
            <p className="text-sm text-gray-500">
              The season is now active. Visit your league to manage race lineups and view standings.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
