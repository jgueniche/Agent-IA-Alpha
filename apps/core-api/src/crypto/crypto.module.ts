import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** Module global exposant le service de chiffrement des champs sensibles. */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
