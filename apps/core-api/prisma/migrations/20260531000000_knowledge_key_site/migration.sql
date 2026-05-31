-- AlterTable
ALTER TABLE "knowledge_items" ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "siteSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_items_key_key" ON "knowledge_items"("key");

