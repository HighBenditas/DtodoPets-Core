CREATE TYPE "AuditOutcome" AS ENUM ('ATTEMPTED', 'SUCCEEDED', 'FAILED');

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "outcome" "AuditOutcome" NOT NULL DEFAULT 'ATTEMPTED',
  "method" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "resourceType" TEXT,
  "resourceId" TEXT,
  "correlationId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "httpStatus" INTEGER,
  "durationMs" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditLog_id_organizationId_key" ON "AuditLog"("id", "organizationId");
CREATE INDEX "AuditLog_organizationId_startedAt_idx" ON "AuditLog"("organizationId", "startedAt");
CREATE INDEX "AuditLog_actorUserId_startedAt_idx" ON "AuditLog"("actorUserId", "startedAt");
CREATE INDEX "AuditLog_organizationId_outcome_startedAt_idx" ON "AuditLog"("organizationId", "outcome", "startedAt");
CREATE INDEX "AuditLog_organizationId_resourceType_resourceId_startedAt_idx" ON "AuditLog"("organizationId", "resourceType", "resourceId", "startedAt");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_organizationId_fkey"
FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_content" CHECK (
  "method" IN ('POST', 'PUT', 'PATCH', 'DELETE')
  AND length(btrim("action")) > 0
  AND length(btrim("route")) > 0
  AND length(btrim("sessionId")) > 0
  AND length(btrim("correlationId")) > 0
  AND ("resourceType" IS NULL OR length(btrim("resourceType")) > 0)
  AND ("resourceId" IS NULL OR length(btrim("resourceId")) > 0)
  AND ("ipAddress" IS NULL OR length("ipAddress") BETWEEN 1 AND 64)
),
ADD CONSTRAINT "AuditLog_lifecycle" CHECK (
  (
    "outcome" = 'ATTEMPTED'
    AND "httpStatus" IS NULL
    AND "durationMs" IS NULL
    AND "completedAt" IS NULL
  )
  OR
  (
    "outcome" IN ('SUCCEEDED', 'FAILED')
    AND "httpStatus" BETWEEN 100 AND 599
    AND "durationMs" >= 0
    AND "completedAt" IS NOT NULL
    AND "completedAt" >= "startedAt"
  )
);

CREATE FUNCTION protect_audit_log() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog is append-only';
  END IF;

  IF OLD."outcome" <> 'ATTEMPTED' OR NEW."outcome" = 'ATTEMPTED' THEN
    RAISE EXCEPTION 'AuditLog outcome is immutable after completion';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
    OR NEW."actorUserId" IS DISTINCT FROM OLD."actorUserId"
    OR NEW."sessionId" IS DISTINCT FROM OLD."sessionId"
    OR NEW."method" IS DISTINCT FROM OLD."method"
    OR NEW."action" IS DISTINCT FROM OLD."action"
    OR NEW."route" IS DISTINCT FROM OLD."route"
    OR NEW."resourceType" IS DISTINCT FROM OLD."resourceType"
    OR NEW."correlationId" IS DISTINCT FROM OLD."correlationId"
    OR NEW."ipAddress" IS DISTINCT FROM OLD."ipAddress"
    OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt"
    OR (OLD."resourceId" IS NOT NULL AND NEW."resourceId" IS DISTINCT FROM OLD."resourceId")
  THEN
    RAISE EXCEPTION 'AuditLog identity is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION protect_audit_log();
