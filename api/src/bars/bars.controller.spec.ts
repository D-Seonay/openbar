import { GUARDS_METADATA } from '@nestjs/common/constants';
import { BarsController } from './bars.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('BarsController route guards', () => {
  it('protects findMembers (GET /bars/:id/members) with JwtAuthGuard', () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, BarsController.prototype.findMembers) ??
      [];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('applies at least one guard to every route handler on the controller', () => {
    const handlerNames = Object.getOwnPropertyNames(
      BarsController.prototype,
    ).filter((name) => name !== 'constructor');

    const unguarded = handlerNames.filter((name) => {
      const handler = (BarsController.prototype as Record<string, unknown>)[
        name
      ] as (...args: unknown[]) => unknown;
      const guards: unknown[] =
        Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
      return guards.length === 0;
    });

    expect(unguarded).toEqual([]);
  });
});
