import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@repo/types';

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();
    this.logger.error('Unhandled websocket error:', exception as Error);
    if (client && typeof client.emit === 'function') {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error' });
    }
  }
}
