import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByUsername: jest.Mock };

  beforeEach(async () => {
    usersService = { findByUsername: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('logs in successfully with correct credentials and returns a signed token', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'ADMIN',
      vip: true,
    });

    const result = await service.login('noa', 'secret123');

    expect(result.token).toBe('signed.jwt.token');
    expect(result.user).toEqual({ id: '1', username: 'noa', role: 'ADMIN', vip: true });
  });

  it('rejects login with a wrong password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'USER',
      vip: false,
    });

    await expect(service.login('noa', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for an unknown username', async () => {
    usersService.findByUsername.mockResolvedValue(null);

    await expect(service.login('ghost', 'whatever')).rejects.toThrow(UnauthorizedException);
  });
});
