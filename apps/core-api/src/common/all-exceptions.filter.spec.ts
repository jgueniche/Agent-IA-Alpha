import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(captured: { status?: number; body?: any }) {
  const res = {
    status: (s: number) => {
      captured.status = s;
      return res;
    },
    json: (b: any) => {
      captured.body = b;
      return res;
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'GET', path: '/api/test' }),
    }),
  } as any;
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('renvoie un message générique pour une erreur non HTTP (pas de fuite)', () => {
    const captured: any = {};
    // Une erreur interne contenant une donnée sensible NE DOIT PAS fuiter.
    filter.catch(new Error('SQL: SELECT phone 0612345678'), makeHost(captured));
    expect(captured.status).toBe(500);
    expect(captured.body.message).toBe('Erreur interne');
    expect(JSON.stringify(captured.body)).not.toContain('0612345678');
  });

  it('préserve le message maîtrisé d une HttpException', () => {
    const captured: any = {};
    filter.catch(new BadRequestException('Email invalide'), makeHost(captured));
    expect(captured.status).toBe(400);
    expect(captured.body.message).toBe('Email invalide');
  });
});
