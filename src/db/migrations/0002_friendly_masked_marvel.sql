-- roster_events: append-only event log for roster ownership changes
-- Part of M002: Event-Sourced Roster Model

CREATE TYPE "public"."roster_event_type" AS ENUM('drafted', 'transferred_in', 'transferred_out', 'dropped', 'ir_placed', 'ir_returned');--> statement-breakpoint

CREATE TABLE "roster_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"leagueId" integer NOT NULL,
	"teamId" integer NOT NULL,
	"riderId" integer NOT NULL,
	"eventType" "roster_event_type" NOT NULL,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"relatedEventId" integer,
	"metadata" jsonb
);--> statement-breakpoint

ALTER TABLE "roster_events" ADD CONSTRAINT "roster_events_leagueId_leagues_id_fk" FOREIGN KEY ("leagueId") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_events" ADD CONSTRAINT "roster_events_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_events" ADD CONSTRAINT "roster_events_riderId_riders_id_fk" FOREIGN KEY ("riderId") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "roster_events_league_rider_idx" ON "roster_events" USING btree ("leagueId","riderId");--> statement-breakpoint
CREATE INDEX "roster_events_league_team_idx" ON "roster_events" USING btree ("leagueId","teamId");--> statement-breakpoint
CREATE INDEX "roster_events_event_type_idx" ON "roster_events" USING btree ("eventType");
