import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	private readonly logger: Logger = new Logger();

	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const recordTime = Date.now();
		const requestType = context.getType<GqlContextType>();

		if (requestType === 'http') {
			return next.handle();
		}

		if (requestType === 'graphql') {
			const gqlContext = GqlExecutionContext.create(context);
			this.logger.log(`${this.stringify(gqlContext.getContext<{ req: Request }>().req.body)}`, 'REQUEST');

			return next.handle().pipe(
				tap((response) => {
					const responseTime = Date.now() - recordTime;
					this.logger.log(`${this.stringify(response)} - ${responseTime}ms \n\n`, 'RESPONSE');
				}),
			);
		}

		return next.handle();
	}

	/** Short one-line preview. Password values never reach the log. */
	private stringify(context: any): string {
		const masked = JSON.stringify(context, (key: string, value: unknown) => (/password/i.test(key) ? '***' : value));
		return masked?.slice(0, 75) ?? '';
	}
}
