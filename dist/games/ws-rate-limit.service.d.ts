export type RateLimitBucket = 'admin' | 'create_room' | 'external' | 'general';
export interface RateLimitResult {
    allowed: boolean;
    errorCode?: 'RATE_LIMITED' | 'ADMIN_RATE_LIMITED';
    retryAfterMs?: number;
}
interface BucketConfig {
    limit: number;
    windowMs: number;
    lockoutMs?: number;
    errorCode: 'RATE_LIMITED' | 'ADMIN_RATE_LIMITED';
}
export declare function extractClientIp(handshake?: {
    headers?: Record<string, string | string[] | undefined>;
    address?: string;
}): string;
export declare class WsRateLimitService {
    private readonly adminBuckets;
    private readonly socketBuckets;
    isDisabled(): boolean;
    isAdminEvent(event: string): boolean;
    getBucketConfig(bucket: RateLimitBucket): BucketConfig;
    checkBucket(bucket: RateLimitBucket, key: string, now?: number): RateLimitResult;
    checkEvent(params: {
        event: string;
        socketId: string;
        clientIp: string;
        isQuietEvent: boolean;
        isExternalApiEvent?: boolean;
        now?: number;
    }): RateLimitResult;
    clearSocket(socketId: string): void;
}
export {};
