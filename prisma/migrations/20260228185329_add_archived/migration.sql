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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Audit" ("createdAt", "goal", "id", "pinsJson", "screenshotUrl", "url", "userPinsJson") SELECT "createdAt", "goal", "id", "pinsJson", "screenshotUrl", "url", "userPinsJson" FROM "Audit";
DROP TABLE "Audit";
ALTER TABLE "new_Audit" RENAME TO "Audit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
