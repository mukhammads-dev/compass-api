import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Module({
	imports: [
		HttpModule,
		/** registerAsync: the secret is read after ConfigModule has loaded .env */
		JwtModule.registerAsync({
			useFactory: () => ({
				secret: process.env.SECRET_TOKEN,
				signOptions: { expiresIn: '30d' },
			}),
		}),
	],
	providers: [AuthService],
	exports: [AuthService],
})
export class AuthModule {}
