-- Persist visual preferences per authenticated user so they follow the account.
CREATE TABLE IF NOT EXISTS "UiPreference" (
  "userId" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'light',
  "appearance" TEXT NOT NULL DEFAULT 'kordit',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UiPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UiPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
