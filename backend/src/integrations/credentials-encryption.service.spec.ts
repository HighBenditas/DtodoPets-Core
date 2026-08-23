import { ServiceUnavailableException } from '@nestjs/common';
import { CredentialsEncryptionService } from './credentials-encryption.service';

describe('CredentialsEncryptionService', () => {
  const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const service = new CredentialsEncryptionService();

  afterEach(() => {
    if (originalKey === undefined)
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  });

  it('encrypts credentials with authenticated context and decrypts them', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    const encrypted = service.encrypt({ accessToken: 'secret' }, 'org:key');

    expect(encrypted).not.toContain('secret');
    expect(service.decrypt(encrypted, 'org:key')).toEqual({
      accessToken: 'secret',
    });
    expect(() => service.decrypt(encrypted, 'other:key')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects a missing or invalid encryption key', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => service.encrypt({ token: 'secret' }, 'org:key')).toThrow(
      ServiceUnavailableException,
    );
  });
});
