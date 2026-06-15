-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "emoji" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Word_category_lang_idx" ON "Word"("category", "lang");
