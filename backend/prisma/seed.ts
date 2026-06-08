import bcrypt from "bcryptjs";
import { CollectionRole, ConditionGrade, GameCopyFormat, GamePartType, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  await prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      allowPublicSignup: true
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: { role: UserRole.ADMIN },
    create: {
      email: "owner@example.com",
      name: "Owner",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: {},
    create: {
      email: "viewer@example.com",
      name: "Viewer",
      passwordHash,
      role: UserRole.USER
    }
  });

  const n64 = await prisma.platform.upsert({
    where: { name: "Nintendo 64" },
    update: {},
    create: { name: "Nintendo 64", maker: "Nintendo" }
  });

  const switchPlatform = await prisma.platform.upsert({
    where: { name: "Nintendo Switch" },
    update: {},
    create: { name: "Nintendo Switch", maker: "Nintendo" }
  });

  const mario64 = await prisma.game.create({
    data: {
      title: "Super Mario 64",
      releaseYear: 1996,
      platformId: n64.id,
      description: "Nintendo 64 platformer."
    }
  });

  const zelda = await prisma.game.create({
    data: {
      title: "The Legend of Zelda: Breath of the Wild",
      releaseYear: 2017,
      platformId: switchPlatform.id,
      description: "Open-world Zelda adventure."
    }
  });

  const collection = await prisma.collection.create({
    data: {
      name: "Main Shelf",
      description: "Seeded sample collection",
      members: {
        create: [
          { userId: owner.id, role: CollectionRole.OWNER },
          { userId: viewer.id, role: CollectionRole.VIEWER }
        ]
      }
    }
  });

  await prisma.gameCopy.create({
    data: {
      collectionId: collection.id,
      gameId: mario64.id,
      format: GameCopyFormat.PHYSICAL,
      region: "NTSC-U",
      edition: "Player's Choice",
      estimatedValue: 45.00,
      parts: {
        create: [
          { type: GamePartType.CARTRIDGE, condition: ConditionGrade.GOOD },
          { type: GamePartType.MANUAL, condition: ConditionGrade.MISSING },
          { type: GamePartType.BOX, condition: ConditionGrade.MISSING }
        ]
      }
    }
  });

  await prisma.gameCopy.create({
    data: {
      collectionId: collection.id,
      gameId: zelda.id,
      format: GameCopyFormat.PHYSICAL,
      region: "NTSC-U",
      estimatedValue: 35.00,
      parts: {
        create: [
          { type: GamePartType.CARTRIDGE, condition: ConditionGrade.VERY_GOOD },
          { type: GamePartType.CASE, condition: ConditionGrade.VERY_GOOD }
        ]
      }
    }
  });

  console.log("Seed complete");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
