import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import NotificationSchema from '../../schemas/Notification.model';
import { AuthModule } from '../auth/auth.module';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Notification', schema: NotificationSchema }]), AuthModule],
	providers: [NotificationResolver, NotificationService],
	exports: [NotificationService],
})
export class NotificationModule {}
