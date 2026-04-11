import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const hotelName = process.env.HOTEL_NAME ?? 'My Hotel';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'superadmin@hotel.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';

  // 1. Hotel (always id=1 for single-deployment model)
  const hotel = await prisma.hotel.upsert({
    where: { id: 1 },
    update: {},
    create: { name: hotelName },
  });
  console.log(`Hotel: ${hotel.name} (id=${hotel.id})`);

  // 2. Services
  const services = [
    { name: 'Food & Dining', isBillable: true },
    { name: 'Maintenance', isBillable: false },
    { name: 'Room Service', isBillable: false },
  ];
  for (const s of services) {
    const svc = await prisma.service.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
    console.log(`Service: ${svc.name} (billable=${svc.isBillable})`);
  }

  // 3. SUPER_ADMIN
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      hotelId: hotel.id,
      email: adminEmail,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`Admin: ${admin.email} (role=${admin.role})`);

  console.log('\nSeed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
