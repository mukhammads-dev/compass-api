import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BoardArticleModule } from './board-article/board-article.module';
import { CommentModule } from './comment/comment.module';
import { FollowModule } from './follow/follow.module';
import { LikeModule } from './like/like.module';
import { MemberModule } from './member/member.module';
import { MyRoomModule } from './my-room/my-room.module';
import { NoticeModule } from './notice/notice.module';
import { NotificationModule } from './notification/notification.module';
import { ProductModule } from './product/product.module';
import { ViewModule } from './view/view.module';

@Module({
	imports: [
		AuthModule,
		MemberModule,
		ProductModule,
		BoardArticleModule,
		CommentModule,
		LikeModule,
		ViewModule,
		FollowModule,
		NotificationModule,
		NoticeModule,
		MyRoomModule,
	],
})
export class ComponentsModule {}
