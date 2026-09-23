import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app';

async function main() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
