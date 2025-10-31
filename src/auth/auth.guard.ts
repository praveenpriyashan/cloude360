import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Authentication guard for bearer token validation
 * Optional: only enforces auth if INGEST_TOKEN is configured
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly ingestToken: string | undefined;

  constructor(private configService: ConfigService) {
    this.ingestToken = this.configService.get<string>('auth.ingestToken');

    if (!this.ingestToken) {
      this.logger.warn(
        '⚠️ INGEST_TOKEN not configured - authentication is disabled',
      );
    } else {
      this.logger.log('✅ Bearer token authentication enabled');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // If no token configured, allow access (optional auth)
    if (!this.ingestToken) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.warn('Request blocked: No Authorization header');
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      this.logger.warn(`Request blocked: Invalid scheme '${scheme}'`);
      throw new UnauthorizedException(
        'Invalid authentication scheme. Use Bearer token.',
      );
    }

    if (!token) {
      this.logger.warn('Request blocked: No token provided');
      throw new UnauthorizedException('Missing authentication token');
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.constantTimeCompare(token, this.ingestToken)) {
      this.logger.warn('Request blocked: Invalid token');
      throw new UnauthorizedException('Invalid authentication token');
    }

    // Authentication successful
    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

