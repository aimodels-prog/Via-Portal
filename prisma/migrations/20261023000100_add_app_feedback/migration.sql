CREATE TABLE "AppFeedback" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "category" TEXT NOT NULL DEFAULT 'suggestion',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppFeedback_applicationId_createdAt_idx"
ON "AppFeedback"("applicationId", "createdAt");

CREATE INDEX "AppFeedback_status_createdAt_idx"
ON "AppFeedback"("status", "createdAt");

ALTER TABLE "AppFeedback"
ADD CONSTRAINT "AppFeedback_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
