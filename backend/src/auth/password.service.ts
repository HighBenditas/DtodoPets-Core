import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const algorithm = 'scrypt';
const cost = 16384;
const blockSize = 8;
const parallelization = 1;
const derivedKeyLength = 64;

@Injectable()
export class PasswordService {
  async hash(password: string) {
    const salt = randomBytes(16);
    const derivedKey = await deriveKey(password, salt);

    return [
      algorithm,
      cost,
      blockSize,
      parallelization,
      salt.toString('base64url'),
      derivedKey.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string) {
    const [
      storedAlgorithm,
      storedCost,
      storedBlockSize,
      storedParallelization,
      saltValue,
      hashValue,
    ] = encodedHash.split('$');

    if (
      storedAlgorithm !== algorithm ||
      Number(storedCost) !== cost ||
      Number(storedBlockSize) !== blockSize ||
      Number(storedParallelization) !== parallelization ||
      !saltValue ||
      !hashValue
    ) {
      return false;
    }

    const salt = Buffer.from(saltValue, 'base64url');
    const expectedHash = Buffer.from(hashValue, 'base64url');

    if (expectedHash.length !== derivedKeyLength) {
      return false;
    }

    const actualHash = await deriveKey(password, salt);
    return timingSafeEqual(expectedHash, actualHash);
  }
}

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      derivedKeyLength,
      {
        N: cost,
        maxmem: 64 * 1024 * 1024,
        p: parallelization,
        r: blockSize,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}
