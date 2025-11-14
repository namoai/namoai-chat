-- Create notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  type VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  link VARCHAR(1000),
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" INTEGER,
  "characterId" INTEGER,
  "commentId" INTEGER,
  "reportId" INTEGER,
  CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON notifications("userId", "isRead", "createdAt");
CREATE INDEX "notifications_userId_createdAt_idx" ON notifications("userId", "createdAt");

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications for various activities';


