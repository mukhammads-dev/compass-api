import { ApolloDriver } from '@nestjs/apollo';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import type { GraphQLFormattedError } from 'graphql';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';
import { SocketModule } from './socket/socket.module';

const graphqlLogger = new Logger('GraphQL');

/** Shape Nest/Apollo put on error.extensions (HttpException response is nested inside). */
interface GqlErrorExtensions {
	code?: string;
	exception?: { response?: { message?: string | string[] } };
	response?: { message?: string | string[] };
}

@Module({
	imports: [
		ConfigModule.forRoot(),
		GraphQLModule.forRoot({
			driver: ApolloDriver,
			playground: process.env.NODE_ENV !== 'production',
			uploads: false,
			autoSchemaFile: true,
			formatError: (error: GraphQLFormattedError) => {
				const extensions = error.extensions as GqlErrorExtensions | undefined;
				const graphQLFormattedError = {
					code: extensions?.code,
					message: extensions?.exception?.response?.message || extensions?.response?.message || error.message,
				};
				graphqlLogger.error(`GRAPHQL GLOBAL ERROR: ${JSON.stringify(graphQLFormattedError)}`);
				return graphQLFormattedError;
			},
		}),
		ComponentsModule,
		DatabaseModule,
		SocketModule,
	],
	controllers: [AppController],
	providers: [AppService, AppResolver],
})
export class AppModule {}
