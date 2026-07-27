import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByUsername: jest.Mock; create: jest.Mock; findById: jest.Mock; update: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    usersService = { findByUsername: jest.fn(), create: jest.fn(), findById: jest.fn(), update: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
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
      mustChangePassword: false,
    });

    const result = await service.login('noa', 'secret123');

    expect(result.token).toBe('signed.jwt.token');
    expect(result.user).toEqual({ id: '1', username: 'noa', role: 'ADMIN', vip: true });
  });

  it('signs an ADMIN token with a 24h expiry', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'ADMIN',
      vip: true,
      mustChangePassword: false,
    });

    await service.login('noa', 'secret123');

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ADMIN' }),
      { expiresIn: '24h' },
    );
  });

  it('signs a USER token with a 30d expiry', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'USER',
      vip: false,
      mustChangePassword: false,
    });

    await service.login('noa', 'secret123');

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'USER' }),
      { expiresIn: '30d' },
    );
  });

  it('rejects login with a wrong password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'USER',
      vip: false,
      mustChangePassword: false,
    });

    await expect(service.login('noa', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects login for an unknown username', async () => {
    usersService.findByUsername.mockResolvedValue(null);

    await expect(service.login('ghost', 'whatever')).rejects.toThrow(UnauthorizedException);
  });

  it('creates a new account and returns a signed token on signup', async () => {
    usersService.create.mockResolvedValue({
      id: '2',
      username: 'newuser',
      role: 'USER',
      vip: false,
    });

    const result = await service.signup('newuser', 'secret123');

    expect(usersService.create).toHaveBeenCalledWith({ username: 'newuser', password: 'secret123' });
    expect(result.token).toBe('signed.jwt.token');
    expect(result.user).toEqual({ id: '2', username: 'newuser', role: 'USER', vip: false });
  });

  it('includes mustChangePassword: true in the JWT payload when the account must change its password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    usersService.findByUsername.mockResolvedValue({
      id: '1',
      username: 'noa',
      passwordHash,
      role: 'USER',
      vip: false,
      mustChangePassword: true,
    });

    await service.login('noa', 'secret123');

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: true }),
      { expiresIn: '30d' },
    );
  });

  it('includes mustChangePassword: false on a fresh signup', async () => {
    usersService.create.mockResolvedValue({
      id: '2',
      username: 'newuser',
      role: 'USER',
      vip: false,
      mustChangePassword: false,
    });

    await service.signup('newuser', 'secret123');

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: false }),
      { expiresIn: '30d' },
    );
  });

  describe('changePassword', () => {
    it('updates the password and clears mustChangePassword when the current password is correct', async () => {
      const passwordHash = await bcrypt.hash('temp1234', 10);
      usersService.findById.mockResolvedValue({
        id: '1',
        username: 'noa',
        passwordHash,
        role: 'USER',
        vip: false,
        mustChangePassword: true,
      });
      usersService.update.mockResolvedValue({
        id: '1',
        username: 'noa',
        role: 'USER',
        vip: false,
        mustChangePassword: false,
      });

      const result = await service.changePassword('1', 'temp1234', 'newsecret123');

      expect(usersService.update).toHaveBeenCalledWith('1', {
        password: 'newsecret123',
        mustChangePassword: false,
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ mustChangePassword: false }),
        { expiresIn: '30d' },
      );
      expect(result.token).toBe('signed.jwt.token');
    });

    it('rejects with UnauthorizedException when the current password is wrong', async () => {
      const passwordHash = await bcrypt.hash('temp1234', 10);
      usersService.findById.mockResolvedValue({
        id: '1',
        username: 'noa',
        passwordHash,
        role: 'USER',
        vip: false,
        mustChangePassword: true,
      });

      await expect(service.changePassword('1', 'wrongpassword', 'newsecret123')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('rejects with UnauthorizedException when the user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.changePassword('ghost', 'whatever', 'newsecret123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
