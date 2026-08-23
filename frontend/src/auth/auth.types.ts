export interface AuthenticatedUser {
  email: string;
  firstName: string;
  id: string;
  lastName: string | null;
  organizationId: string;
  organizationSlug: string;
  permissions: string[];
  roles: string[];
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: 'Bearer';
  user: AuthenticatedUser;
}

export interface LoginInput {
  email: string;
  organizationSlug: string;
  password: string;
}

