"use server";

import { draftPicks, draftSessions } from "@/db/schema/draft";
import { leagues, teams } from "@/db/schema/leagues";
import { riders } from "@/db/schema/riders";
import { rosterSlots } from "@/db/schema/roster-slots";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  computeNextDraftState,
  getAvailableRiders,
  getDraftStateEnriched,
} from "@/lib/draft-queries";
import { buildDraftOrder } from "@/lib/draft-snake-order";
import { checkLeagueMembership, checkLeagueOwnership } from "@/lib/league-auth";
import { pusherServer } from "@/lib/pusher-server";
import { emitRosterEvent } from "@/lib/roster-events";
import { Client } from "@upstash/qstash";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const MEN_ROUNDS = 18;
const WOMEN_ROUNDS = 6;
const TIMER_MS = 300_000;
const QSTASH_DELAY_S = 305;

function getQStashClient() {
  return new Client({ token: process.env.QSTASH_TOKEN! });
}

async function scheduleAutoPick(leagueId: number, expectedPickIndex: number) {
  if (!process.env.QSTASH_TOKEN || !process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("QStash not configured — auto-pick timer disabled");
    return;
  }
  try {
    const qstash = getQStashClient();
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/draft/auto-pick`;
    await qstash.publishJSON({
      url,
      body: { leagueId, expectedPickIndex },
      delay: QSTASH_DELAY_S,
    });
  } catch (e) {
    console.error("Failed to schedule auto-pick via QStash:", e);
  }
}

/**
 * Start the draft for a league. Only callable by the league owner.
 * League must be in 'drafting' status and have at least 2 teams.
 */
export async function startDraft(leagueId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const isOwner = await checkLeagueOwnership(session.user.id, leagueId);
  if (!isOwner) {
    return {
      success: false,
      error: "Only the league owner can start the draft",
    };
  }

  // Verify league status
  const [league] = await db
    .select()
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1);

  if (!league) {
    return { success: false, error: "League not found" };
  }

  if (league.status !== "drafting") {
    return {
      success: false,
      error: "League must be in drafting status to start the draft",
    };
  }

  // Fetch all teams ordered by createdAt
  const leagueTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.createdAt));

  if (leagueTeams.length < 2) {
    return {
      success: false,
      error: "At least 2 teams are required to start the draft",
    };
  }

  // Build the full snake draft order
  const draftOrder = buildDraftOrder(leagueTeams, MEN_ROUNDS, WOMEN_ROUNDS);
  const firstTeamId = draftOrder[0].teamId;
  const timerExpiresAt = new Date(Date.now() + TIMER_MS);
  const startedAt = new Date();

  // Insert draft session in a transaction
  let insertedSession: typeof draftSessions.$inferSelect;

  await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(draftSessions)
      .values({
        leagueId,
        status: "men",
        currentPickIndex: 0,
        currentTeamId: firstTeamId,
        currentGender: "M",
        timerExpiresAt,
        startedAt,
      })
      .returning();
    insertedSession = s;
  });

  // After transaction: trigger Pusher event (before QStash so clients update immediately)
  try {
    await pusherServer.trigger(`presence-draft-${leagueId}`, "draft-started", {
      status: "men",
      currentTeamId: firstTeamId,
      currentPickIndex: 0,
      timerExpiresAt,
      teams: leagueTeams,
      draftOrder,
    });
  } catch (e) {
    console.error("Failed to trigger Pusher draft-started event:", e);
  }

  // After transaction: schedule QStash auto-pick (non-fatal)
  await scheduleAutoPick(leagueId, 0);

  revalidatePath(`/leagues/${leagueId}/draft`);

  return { success: true };
}

/**
 * Make a pick in the active draft.
 * Validates: it's the user's turn, rider is available, gender matches.
 */
export async function makePick(leagueId: number, riderId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Fetch draft session
  const [draftSession] = await db
    .select()
    .from(draftSessions)
    .where(eq(draftSessions.leagueId, leagueId))
    .limit(1);

  if (!draftSession) {
    return { success: false, error: "No active draft session for this league" };
  }

  if (draftSession.status !== "men" && draftSession.status !== "women") {
    return { success: false, error: "Draft is not currently active" };
  }

  // Verify it's the user's turn
  const { isMember, team } = await checkLeagueMembership(
    session.user.id,
    leagueId,
  );
  if (!isMember || !team) {
    return { success: false, error: "You are not a member of this league" };
  }

  if (team.id !== draftSession.currentTeamId) {
    return { success: false, error: "It is not your turn to pick" };
  }

  // Verify rider gender matches current draft gender
  const [rider] = await db
    .select()
    .from(riders)
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider) {
    return { success: false, error: "Rider not found" };
  }

  if (rider.gender !== draftSession.currentGender) {
    return {
      success: false,
      error: `Must pick a ${draftSession.currentGender === "M" ? "male" : "female"} rider during ${draftSession.currentGender === "M" ? "men's" : "women's"} draft`,
    };
  }

  // Verify rider not already picked in this league
  const existingPick = await db
    .select()
    .from(draftPicks)
    .where(
      and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.riderId, riderId)),
    )
    .limit(1);

  if (existingPick.length > 0) {
    return { success: false, error: "This rider has already been picked" };
  }

  // Compute next state
  const leagueTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.createdAt));

  const teamCount = leagueTeams.length;
  const currentPickIndex = draftSession.currentPickIndex;
  const {
    nextPickIndex,
    nextRound,
    nextGender,
    nextTeamIndex,
    isComplete,
    isMenComplete,
  } = computeNextDraftState(
    currentPickIndex,
    teamCount,
    MEN_ROUNDS,
    WOMEN_ROUNDS,
  );

  const nextTeamId = isComplete ? null : leagueTeams[nextTeamIndex].id;
  const nextTimerExpiresAt = isComplete
    ? null
    : new Date(Date.now() + TIMER_MS);
  const nextStatus = isComplete
    ? "complete"
    : isMenComplete
      ? "women"
      : draftSession.status;
  const completedAt = isComplete ? new Date() : null;

  // Compute round for this pick
  const menTotalPicks = teamCount * MEN_ROUNDS;
  let currentRound: number;
  if (draftSession.currentGender === "M") {
    currentRound = Math.floor(currentPickIndex / teamCount);
  } else {
    currentRound =
      MEN_ROUNDS + Math.floor((currentPickIndex - menTotalPicks) / teamCount);
  }

  // Insert pick and update session in transaction
  let insertedPick: typeof draftPicks.$inferSelect;

  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(draftPicks)
      .values({
        leagueId,
        teamId: team.id,
        riderId,
        pickNumber: currentPickIndex,
        round: currentRound,
        gender: draftSession.currentGender as "M" | "F",
        wasAutomatic: false,
      })
      .returning();
    insertedPick = p;

    // Roster event
    await emitRosterEvent(tx, {
      leagueId,
      teamId: team.id,
      riderId,
      eventType: "drafted",
      occurredAt: insertedPick.pickedAt,
      metadata: { pickNumber: currentPickIndex, round: currentRound, gender: draftSession.currentGender },
    });

    await tx.insert(rosterSlots).values({
      leagueId,
      teamId: team.id,
      riderId,
      status: "active",
    });

    await tx
      .update(draftSessions)
      .set({
        currentPickIndex: nextPickIndex,
        currentTeamId: nextTeamId,
        currentGender: nextGender,
        timerExpiresAt: nextTimerExpiresAt,
        status: nextStatus as
          | "men"
          | "women"
          | "complete"
          | "pending"
          | "paused",
        ...(completedAt ? { completedAt } : {}),
      })
      .where(eq(draftSessions.leagueId, leagueId));

    if (isComplete) {
      await tx
        .update(leagues)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(leagues.id, leagueId), eq(leagues.status, "drafting")));
    }
  });

  // After transaction: trigger Pusher events first (so clients update immediately)
  try {
    await pusherServer.trigger(`presence-draft-${leagueId}`, "pick-made", {
      pick: {
        ...insertedPick!,
        rider: {
          name: rider.name,
          team: rider.team,
          nationality: rider.nationality,
        },
      },
      nextTeamId,
      nextPickIndex,
      timerExpiresAt: nextTimerExpiresAt,
      status: nextStatus,
      wasAutomatic: false,
    });

    if (isComplete) {
      await pusherServer.trigger(
        `presence-draft-${leagueId}`,
        "draft-complete",
        {
          leagueId,
        },
      );
    }
  } catch (e) {
    console.error("Failed to trigger Pusher pick-made event:", e);
  }

  // After transaction: schedule next auto-pick if draft not complete (non-fatal)
  if (!isComplete) {
    await scheduleAutoPick(leagueId, nextPickIndex);
  }

  revalidatePath(`/leagues/${leagueId}/draft`);

  return { success: true, pick: insertedPick! };
}

/**
 * Skip the current pick (timer expired, no rider selected).
 * Advances the draft to the next team without inserting a pick.
 * Any league member can call this when the timer has expired.
 */
export async function skipPick(leagueId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const { isMember } = await checkLeagueMembership(session.user.id, leagueId);
  if (!isMember) {
    return { success: false, error: "You are not a member of this league" };
  }

  const [draftSession] = await db
    .select()
    .from(draftSessions)
    .where(eq(draftSessions.leagueId, leagueId))
    .limit(1);

  if (!draftSession) {
    return { success: false, error: "No active draft session" };
  }

  if (draftSession.status !== "men" && draftSession.status !== "women") {
    return { success: false, error: "Draft is not currently active" };
  }

  // Only allow skip if timer has actually expired (with 2s grace)
  if (
    draftSession.timerExpiresAt &&
    new Date() < new Date(draftSession.timerExpiresAt.getTime() - 2000)
  ) {
    return { success: false, error: "Timer has not expired yet" };
  }

  const leagueTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.createdAt));

  const teamCount = leagueTeams.length;
  const currentPickIndex = draftSession.currentPickIndex;
  const {
    nextPickIndex,
    nextGender,
    nextTeamIndex,
    isComplete,
    isMenComplete,
  } = computeNextDraftState(
    currentPickIndex,
    teamCount,
    MEN_ROUNDS,
    WOMEN_ROUNDS,
  );

  const nextTeamId = isComplete ? null : leagueTeams[nextTeamIndex].id;
  const nextTimerExpiresAt = isComplete
    ? null
    : new Date(Date.now() + TIMER_MS);
  const nextStatus = isComplete
    ? "complete"
    : isMenComplete
      ? "women"
      : draftSession.status;
  const completedAt = isComplete ? new Date() : null;

  await db.transaction(async (tx) => {
    await tx
      .update(draftSessions)
      .set({
        currentPickIndex: nextPickIndex,
        currentTeamId: nextTeamId,
        currentGender: nextGender,
        timerExpiresAt: nextTimerExpiresAt,
        status: nextStatus as "men" | "women" | "complete" | "pending" | "paused",
        ...(completedAt ? { completedAt } : {}),
      })
      .where(eq(draftSessions.leagueId, leagueId));

    if (isComplete) {
      await tx
        .update(leagues)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(leagues.id, leagueId), eq(leagues.status, "drafting")));
    }
  });

  // Trigger Pusher event
  try {
    const skippedTeam = leagueTeams.find(
      (t) => t.id === draftSession.currentTeamId,
    );
    await pusherServer.trigger(`presence-draft-${leagueId}`, "pick-skipped", {
      skippedTeamId: draftSession.currentTeamId,
      skippedTeamName: skippedTeam?.name ?? "Unknown",
      skippedPickIndex: currentPickIndex,
      nextTeamId,
      nextPickIndex,
      timerExpiresAt: nextTimerExpiresAt,
      status: nextStatus,
    });

    if (isComplete) {
      await pusherServer.trigger(
        `presence-draft-${leagueId}`,
        "draft-complete",
        {
          leagueId,
        },
      );
    }
  } catch (e) {
    console.error("Failed to trigger Pusher pick-skipped event:", e);
  }

  await scheduleAutoPick(leagueId, nextPickIndex);

  revalidatePath(`/leagues/${leagueId}/draft`);

  return { success: true, nextTeamId, nextPickIndex, status: nextStatus };
}

/**
 * Returns the full enriched draft state for reconnecting clients.
 * Validates that the calling user is a league member before returning data.
 */
export async function refreshDraftState(leagueId: number) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false as const, error: "Unauthorized" };
  }

  const { isMember } = await checkLeagueMembership(session.user.id, leagueId);
  if (!isMember) {
    return { success: false as const, error: "Not a member of this league" };
  }

  const state = await getDraftStateEnriched(leagueId);
  if (!state) {
    return { success: false as const, error: "No draft session found" };
  }

  const availableMen = await getAvailableRiders(leagueId, "M");
  const availableWomen = await getAvailableRiders(leagueId, "F");

  return {
    success: true as const,
    session: state.session,
    picks: state.picks,
    teams: state.teams,
    availableMen,
    availableWomen,
  };
}
