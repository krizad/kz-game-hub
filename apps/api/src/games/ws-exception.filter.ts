import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@repo/types';

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();
    console.error('Unhandled websocket error:', exception);
    if (client && typeof client.emit === 'function') {
      client.emit(SOCKET_EVENTS.ERROR, { message: 'Internal server error' });
    }
  }
}
