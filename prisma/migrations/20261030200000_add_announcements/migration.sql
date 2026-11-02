CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "publishedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Announcement_category_priority_idx" ON "Announcement"("category", "priority");
CREATE INDEX "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");
