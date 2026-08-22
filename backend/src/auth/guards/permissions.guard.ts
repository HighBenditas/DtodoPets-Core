import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../auth.types';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionKey } from '../permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndMerge<PermissionKey[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getClass(), context.getHandler()],
    );

    if (!required?.length) {
      return true;
    }

    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().user;

    if (
      !principal ||
      !required.every((permission) =>
        principal.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
