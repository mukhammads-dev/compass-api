import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CommentSchema from '../../schemas/Comment.model';
import { AuthModule } from '../auth/auth.module';
import { BoardArticleModule } from '../board-article/board-article.module';
import { MemberModule } from '../member/member.module';
import { NotificationModule } from '../notification/notification.module';
import { ProductModule } from '../product/product.module';
import { CommentResolver } from './comment.resolver';
import { CommentService } from './comment.service';

@Module({
	imports: [
		MongooseModule.forFeature([{ name: 'Comment', schema: CommentSchema }]),
		AuthModule,
		MemberModule,
		ProductModule,
		BoardArticleModule,
		NotificationModule,
	],
	providers: [CommentResolver, CommentService],
})
export class CommentModule {}
