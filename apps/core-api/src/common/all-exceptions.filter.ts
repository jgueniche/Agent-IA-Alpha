import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filtre global d'exceptions : garantit qu'aucune donnée sensible ni détail
 * interne (stack, requête SQL, contenu patient) ne fuite dans les réponses
 * d'erreur ni dans les logs. Les HttpException conservent leur message (maîtrisé) ;
 * toute autre erreur renvoie un message générique.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Message : pour une HttpException on réutilise son message (maîtrisé,
    // sans donnée patient) ; sinon message générique.
    let message: string | string[] = 'Erreur interne';
    if (isHttp) {
      const resp = exception.getResponse();
      message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? exception.message);
    }

    // Log neutre : méthode + chemin + statut, jamais le corps ni les paramètres.
    this.logger.warn(`${req.method} ${req.path} -> ${status}`);

    res.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
