import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class WsExceptionFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
}
