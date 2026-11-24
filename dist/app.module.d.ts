import { OnApplicationShutdown } from '@nestjs/common';
export declare class AppModule implements OnApplicationShutdown {
    private readonly logger;
    onApplicationShutdown(signal?: string): void;
}
