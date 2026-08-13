import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { JwtPayload } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_COOKIE } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * `remember` false leaves `maxAge` off, which makes it a session cookie: it
   * dies when the browser closes, which is the point of unticking the box on a
   * borrowed device.
   */
  private setSessionCookie(res: Response, token: string, remember = true) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      ...(remember ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}),
    });
  }

  @Post('signup')
  @HttpCode(200)
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.signup(
      dto.username,
      dto.password,
    );
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Absent means "as before": the old token lifetimes, and a 30-day cookie.
    // Only an explicit `false` shortens the cookie to the browser session.
    const { token, user } = await this.authService.login(
      dto.username,
      dto.password,
      dto.rememberMe === true,
    );
    this.setSessionCookie(res, token, dto.rememberMe !== false);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE);
    return { success: true };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const currentUser = req.user as JwtPayload;
    // Carry the existing choice over, so changing a password does not quietly
    // shorten a session the person asked to keep. Tokens minted before this
    // field existed have no preference, which reads as the old behaviour.
    const remember = currentUser.remember === true;
    const { token, user } = await this.authService.changePassword(
      currentUser.sub,
      dto.currentPassword,
      dto.newPassword,
      remember,
    );
    this.setSessionCookie(res, token, remember);
    return { user };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const currentUser = req.user as JwtPayload;
    return this.authService.getProfile(currentUser.sub);
  }

  @Patch('profile')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const currentUser = req.user as JwtPayload;
    return this.authService.updateProfile(currentUser.sub, dto);
  }
}
