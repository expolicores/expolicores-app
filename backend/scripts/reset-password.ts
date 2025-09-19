import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const [,, email, newPass] = process.argv;
  if (!email || !newPass) {
    console.error('Uso: tsx scripts/reset-password.ts <email> <nueva_clave>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPass, 10);
  await prisma.user.update({ where: { email }, data: { password: hash } });
  console.log('🔐 Password reseteado para', email);
}
main().finally(() => prisma.$disconnect());