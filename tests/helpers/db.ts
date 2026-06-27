import { clearOperationalData, seedBaseData } from "@/prisma/seed-data";
import { prisma } from "@/server/db";

export { prisma };

/** Reset the test DB to the known starting state (base data, no operational records). */
export async function resetTestDb() {
  await clearOperationalData(prisma);
  await seedBaseData(prisma);
}
