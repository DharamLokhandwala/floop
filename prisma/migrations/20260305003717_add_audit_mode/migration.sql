-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "pinsJson" TEXT NOT NULL,
    "userPinsJson" TEXT DEFAULT '[]',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "shareVisibility" TEXT NOT NULL DEFAULT 'private',
    "mode" TEXT NOT NULL DEFAULT 'give_feedback',
    CONSTRAINT "Audit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Audit" ("archived", "createdAt", "createdById", "goal", "id", "pinsJson", "screenshotUrl", "shareVisibility", "url", "userPinsJson") SELECT "archived", "createdAt", "createdById", "goal", "id", "pinsJson", "screenshotUrl", "shareVisibility", "url", "userPinsJson" FROM "Audit";
DROP TABLE "Audit";
ALTER TABLE "new_Audit" RENAME TO "Audit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
