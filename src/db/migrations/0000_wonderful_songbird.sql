CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."race_type" AS ENUM('grand_tour', 'high_priority_one_day', 'low_priority_one_day', 'mini_tour', 'womens_grand_tour', 'womens_one_day', 'world_championship');--> statement-breakpoint
CREATE TABLE "orderTypes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"displayName" text NOT NULL,
	"applicableRaceTypes" jsonb NOT NULL,
	"effect" jsonb NOT NULL,
	"description" text,
	CONSTRAINT "orderTypes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rosterLimits" (
	"id" serial PRIMARY KEY NOT NULL,
	"raceType" text NOT NULL,
	"rosterSize" integer NOT NULL,
	"description" text,
	CONSTRAINT "rosterLimits_raceType_unique" UNIQUE("raceType")
);
--> statement-breakpoint
CREATE TABLE "scoringConfig" (
	"id" serial PRIMARY KEY NOT NULL,
	"raceType" text NOT NULL,
	"category" text NOT NULL,
	"rules" jsonb NOT NULL,
	"description" text,
	"validFrom" timestamp NOT NULL,
	"validUntil" timestamp
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"team" text NOT NULL,
	"nationality" text NOT NULL,
	"gender" "gender" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"raceType" "race_type" NOT NULL,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone,
	"parentRaceId" integer,
	"stageNumber" integer,
	"season" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_parentRaceId_races_id_fk" FOREIGN KEY ("parentRaceId") REFERENCES "public"."races"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "riders_name_idx" ON "riders" USING btree ("name");--> statement-breakpoint
CREATE INDEX "riders_team_idx" ON "riders" USING btree ("team");--> statement-breakpoint
CREATE INDEX "riders_nationality_idx" ON "riders" USING btree ("nationality");--> statement-breakpoint
CREATE INDEX "races_parent_race_idx" ON "races" USING btree ("parentRaceId");--> statement-breakpoint
CREATE INDEX "races_race_type_idx" ON "races" USING btree ("raceType");--> statement-breakpoint
CREATE INDEX "races_season_idx" ON "races" USING btree ("season");--> statement-breakpoint
CREATE INDEX "races_start_date_idx" ON "races" USING btree ("startDate");