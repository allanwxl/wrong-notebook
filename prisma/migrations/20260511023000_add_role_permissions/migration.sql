-- Add role permission and assignment data.
ALTER TABLE "User" ADD COLUMN "canUploadErrors" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ErrorItem" ADD COLUMN "assignedByTeacherId" TEXT;
ALTER TABLE "ErrorItem" ADD COLUMN "sourceErrorItemId" TEXT;

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceErrorItemId" TEXT NOT NULL,
    "studentErrorItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_sourceErrorItemId_fkey" FOREIGN KEY ("sourceErrorItemId") REFERENCES "ErrorItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_studentErrorItemId_fkey" FOREIGN KEY ("studentErrorItemId") REFERENCES "ErrorItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ErrorItem_assignedByTeacherId_idx" ON "ErrorItem"("assignedByTeacherId");
CREATE INDEX "ErrorItem_sourceErrorItemId_idx" ON "ErrorItem"("sourceErrorItemId");
CREATE UNIQUE INDEX "Assignment_studentErrorItemId_key" ON "Assignment"("studentErrorItemId");
CREATE UNIQUE INDEX "Assignment_studentId_sourceErrorItemId_key" ON "Assignment"("studentId", "sourceErrorItemId");
CREATE INDEX "Assignment_teacherId_idx" ON "Assignment"("teacherId");
CREATE INDEX "Assignment_studentId_idx" ON "Assignment"("studentId");
CREATE INDEX "Assignment_sourceErrorItemId_idx" ON "Assignment"("sourceErrorItemId");
