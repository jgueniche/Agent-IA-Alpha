import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

/**
 * Point d'entree de core-api.
 * Durcissement de base : helmet, CORS restreint, validation stricte des entrees.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, {
    // Logs structures, sans donnee de sante en clair.
    logger: ['error', 'warn', 'log'],
  });

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Necessaire pour recuperer l'IP reelle derriere le reverse-proxy HDS.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`core-api demarre sur le port ${config.port}`, 'Bootstrap');
}

void bootstrap();
