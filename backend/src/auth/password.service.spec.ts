import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password without storing it', async () => {
    const password = 'Long-development-password-123!';
    const hash = await service.hash(password);

    expect(hash).not.toContain(password);
    await expect(service.verify(password, hash)).resolves.toBe(true);
    await expect(service.verify('wrong-password', hash)).resolves.toBe(false);
  });

  it('rejects an unsupported hash format', async () => {
    await expect(service.verify('password', 'invalid')).resolves.toBe(false);
  });
});
