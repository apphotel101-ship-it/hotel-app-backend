import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// const prisma = new PrismaClient();

 // 1. Setup the connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Create the adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter into the PrismaClient
const prisma = new PrismaClient({ adapter });

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
