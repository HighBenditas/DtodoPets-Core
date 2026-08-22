import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeEmail, normalizeSlug } from '../common/text/normalization';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_ENVIRONMENT } from './auth.config';
import type { AuthEnvironment } from './auth.config';
import type { AccessTokenPayload, AuthenticatedPrincipal } from './auth.types';
import { BootstrapDto } from './dto/bootstrap.dto';
import { LoginDto } from './dto/login.dto';
import { provisionDefaultRbac } from './permissions';
import { PasswordService } from './password.service';

interface AuthorizedUserRecord {
  active: boolean;
  email: string;
  firstName: string;
  id: string;
  lastName: string | null;
  organization: {
    active: boolean;
    id: string;
    slug: string;
  };
  organizationId: string;
  passwordHash: string;
  roles: Array<{
    role: {
      key: string;
      permissions: Array<{ permission: { key: string } }>;
    };
  }>;
}

const authorizationInclude = {
  organization: true,
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    @Inject(AUTH_ENVIRONMENT)
    private readonly environment: AuthEnvironment,
  ) {}

  async bootstrap(dto: BootstrapDto) {
    const email = normalizeEmail(dto.email);
    const organizationSlug = normalizeSlug(
      dto.organizationSlug ?? dto.organizationName,
    );

    if (!organizationSlug) {
      throw new BadRequestException('organizationSlug is invalid');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const refreshToken = createRefreshToken();

    try {
      const result = await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(919274610)`;

          if ((await transaction.user.count()) > 0) {
            throw new ConflictException('Application is already initialized');
          }

          const organization = await transaction.organization.upsert({
            where: { slug: organizationSlug },
            create: {
              name: dto.organizationName.trim(),
              slug: organizationSlug,
            },
            update: {},
          });
          const roles = await provisionDefaultRbac(
            transaction,
            organization.id,
          );
          const ownerRoleId = roles.get('owner');

          if (!ownerRoleId) {
            throw new Error('Owner role was not provisioned');
          }

          const user = await transaction.user.create({
            data: {
              email,
              firstName: dto.firstName.trim(),
              lastName: dto.lastName?.trim(),
              organizationId: organization.id,
              passwordHash,
              roles: { create: { roleId: ownerRoleId } },
            },
            include: authorizationInclude,
          });
          const session = await this.createSession(
            transaction,
            user.id,
            refreshToken,
          );

          return { sessionId: session.id, user };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.buildAuthResponse(
        result.user,
        result.sessionId,
        refreshToken,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException('Application is already initialized');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizeEmail(dto.email),
        organization: {
          active: true,
          slug: normalizeSlug(dto.organizationSlug),
        },
      },
      include: authorizationInclude,
    });

    if (
      !user?.active ||
      !(await this.passwordService.verify(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const refreshToken = createRefreshToken();
    const session = await this.createSession(
      this.prisma,
      user.id,
      refreshToken,
    );

    return this.buildAuthResponse(user, session.id, refreshToken);
  }

  async refresh(refreshToken: string) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: {
        user: { include: authorizationInclude },
      },
    });

    if (!isSessionActive(session)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rotatedRefreshToken = createRefreshToken();
    const update = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash,
        revokedAt: null,
      },
      data: {
        expiresAt: this.getRefreshExpiry(),
        lastUsedAt: new Date(),
        refreshTokenHash: hashRefreshToken(rotatedRefreshToken),
      },
    });

    if (update.count !== 1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(
      session.user,
      session.id,
      rotatedRefreshToken,
    );
  }

  async logout(principal: AuthenticatedPrincipal) {
    await this.prisma.authSession.updateMany({
      where: {
        id: principal.sessionId,
        userId: principal.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    principal: AuthenticatedPrincipal,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: principal.id, organizationId: principal.organizationId },
      select: { passwordHash: true },
    });

    if (
      !user ||
      !(await this.passwordService.verify(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is invalid');
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: principal.id },
        data: { passwordHash },
      }),
      this.prisma.authSession.updateMany({
        where: {
          id: { not: principal.sessionId },
          revokedAt: null,
          userId: principal.id,
        },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async authenticate(accessToken: string): Promise<AuthenticatedPrincipal> {
    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        accessToken,
        { secret: this.environment.jwtAccessSecret },
      );
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!isAccessTokenPayload(payload)) {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: { include: authorizationInclude } },
    });

    if (
      !isSessionActive(session) ||
      session.userId !== payload.sub ||
      session.user.organizationId !== payload.organizationId
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    return toPrincipal(session.user, session.id);
  }

  getProfile(principal: AuthenticatedPrincipal) {
    return {
      email: principal.email,
      firstName: principal.firstName,
      id: principal.id,
      lastName: principal.lastName,
      organizationId: principal.organizationId,
      organizationSlug: principal.organizationSlug,
      permissions: principal.permissions,
      roles: principal.roles,
    };
  }

  private async buildAuthResponse(
    user: AuthorizedUserRecord,
    sessionId: string,
    refreshToken: string,
  ) {
    const principal = toPrincipal(user, sessionId);
    const payload: AccessTokenPayload = {
      organizationId: principal.organizationId,
      sessionId,
      sub: principal.id,
      type: 'access',
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.environment.accessTokenTtlSeconds,
      secret: this.environment.jwtAccessSecret,
    });

    return {
      accessToken,
      expiresIn: this.environment.accessTokenTtlSeconds,
      refreshToken,
      tokenType: 'Bearer',
      user: this.getProfile(principal),
    };
  }

  private createSession(
    prisma: Pick<Prisma.TransactionClient, 'authSession'>,
    userId: string,
    refreshToken: string,
  ) {
    return prisma.authSession.create({
      data: {
        expiresAt: this.getRefreshExpiry(),
        refreshTokenHash: hashRefreshToken(refreshToken),
        userId,
      },
    });
  }

  private getRefreshExpiry() {
    return new Date(
      Date.now() + this.environment.refreshTokenTtlSeconds * 1000,
    );
  }
}

function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function isAccessTokenPayload(
  payload: AccessTokenPayload,
): payload is AccessTokenPayload {
  return (
    payload?.type === 'access' &&
    typeof payload.sub === 'string' &&
    typeof payload.organizationId === 'string' &&
    typeof payload.sessionId === 'string'
  );
}

function isSessionActive(
  session: {
    expiresAt: Date;
    revokedAt: Date | null;
    user: AuthorizedUserRecord;
  } | null,
): session is {
  expiresAt: Date;
  id: string;
  revokedAt: Date | null;
  user: AuthorizedUserRecord;
  userId: string;
} {
  return Boolean(
    session &&
    !session.revokedAt &&
    session.expiresAt.getTime() > Date.now() &&
    session.user.active &&
    session.user.organization.active,
  );
}

function toPrincipal(
  user: AuthorizedUserRecord,
  sessionId: string,
): AuthenticatedPrincipal {
  return {
    email: user.email,
    firstName: user.firstName,
    id: user.id,
    lastName: user.lastName,
    organizationId: user.organizationId,
    organizationSlug: user.organization.slug,
    permissions: [
      ...new Set(
        user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ].sort(),
    roles: [...new Set(user.roles.map(({ role }) => role.key))].sort(),
    sessionId,
  };
}
