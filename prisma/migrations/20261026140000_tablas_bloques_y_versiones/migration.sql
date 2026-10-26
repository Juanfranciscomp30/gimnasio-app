-- CreateEnum
CREATE TYPE "RoutineVariant" AS ENUM ('MEN', 'WOMEN');

-- DropIndex
DROP INDEX "Routine_year_month_weeklyPlan_key";

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "variant" "RoutineVariant" NOT NULL DEFAULT 'MEN';

-- AlterTable
-- "block" es obligatorio: a los ejercicios que ya existieran se les da un
-- bloque propio (su posición) para que sigan comportándose igual.
ALTER TABLE "RoutineExercise" ADD COLUMN     "block" INTEGER;
UPDATE "RoutineExercise" SET "block" = "order";
ALTER TABLE "RoutineExercise" ALTER COLUMN "block" SET NOT NULL;
ALTER TABLE "RoutineExercise" ALTER COLUMN "reps" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "routineVariant" "RoutineVariant";

-- CreateIndex
CREATE UNIQUE INDEX "Routine_year_month_weeklyPlan_variant_key" ON "Routine"("year", "month", "weeklyPlan", "variant");
