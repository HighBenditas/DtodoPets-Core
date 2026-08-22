import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'DTodoPets Core API',
      version: 'v1',
    };
  }
}
