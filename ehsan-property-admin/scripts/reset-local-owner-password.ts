import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/server/password';

const email = 'admin@ehsanproperty.com';
const password = process.argv[2];

if (!password) {
  throw new Error('Provide a replacement password as the first argument.');
}

async function resetPassword() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { passwordHash: await hashPassword(password) },
    });
    console.log(`Password reset for ${user.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
