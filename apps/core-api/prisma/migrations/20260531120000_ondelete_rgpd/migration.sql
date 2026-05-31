-- DropForeignKey
ALTER TABLE "consents" DROP CONSTRAINT "consents_patientId_fkey";

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

