import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let mockConfigService: any;

  const createMockExecutionContext = (headers: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as ExecutionContext;
  };

  describe('with token configured', () => {
    beforeEach(async () => {
      mockConfigService = {
        get: jest.fn().mockReturnValue('test-secret-token'),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthGuard,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      guard = module.get<AuthGuard>(AuthGuard);
    });

    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should allow access with valid Bearer token', () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer test-secret-token',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw UnauthorizedException with missing Authorization header', () => {
      const context = createMockExecutionContext({});

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Missing Authorization header',
      );
    });

    it('should throw UnauthorizedException with invalid scheme', () => {
      const context = createMockExecutionContext({
        authorization: 'Basic test-secret-token',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid authentication scheme. Use Bearer token.',
      );
    });

    it('should throw UnauthorizedException with missing token', () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer ',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Missing authentication token',
      );
    });

    it('should throw UnauthorizedException with invalid token', () => {
      const context = createMockExecutionContext({
        authorization: 'Bearer wrong-token',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid authentication token',
      );
    });
  });

  describe('without token configured (optional auth)', () => {
    beforeEach(async () => {
      mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthGuard,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      guard = module.get<AuthGuard>(AuthGuard);
    });

    it('should allow all requests when token not configured', () => {
      const context = createMockExecutionContext({});

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow requests even without authorization header', () => {
      const context = createMockExecutionContext({
        authorization: undefined,
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});

