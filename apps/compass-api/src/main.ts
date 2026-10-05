import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import * as express from 'express';
import { graphqlUploadExpress } from 'graphql-upload';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './libs/interceptor/Logging.interceptor';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	app.useGlobalInterceptors(new LoggingInterceptor());
	app.enableCors({ origin: true, credentials: true });

	app.use(graphqlUploadExpress({ maxFileSize: 15_000_000, maxFiles: 10 }));
	app.use('/uploads', express.static('./uploads'));

	app.useWebSocketAdapter(new WsAdapter(app));

	const port = process.env.PORT_API ?? 3000;
	await app.listen(port);
	const logger = new Logger('Bootstrap');
	logger.log(`Compass API is running on http://localhost:${port}`);
	logger.log(`GraphQL playground: http://localhost:${port}/graphql`);
}

void bootstrap();
