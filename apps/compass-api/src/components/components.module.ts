import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BoardArticleModule } from './board-article/board-article.module';
import { CartModule } from './cart/cart.module';
import { CommentModule } from './comment/comment.module';
import { FollowModule } from './follow/follow.module';
import { LensModule } from './lens/lens.module';
import { LikeModule } from './like/like.module';
import { MemberModule } from './member/member.module';
import { MyRoomModule } from './my-room/my-room.module';
import { NoticeModule } from './notice/notice.module';
import { NotificationModule } from './notification/notification.module';
import { OrderModule } from './order/order.module';
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
		LensModule,
		CartModule,
		OrderModule,
	],
})
export class ComponentsModule {}
