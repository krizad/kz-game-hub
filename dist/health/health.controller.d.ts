export declare class HealthController {
    check(): Promise<{
        status: string;
        service: string;
        version: string;
        environment: string;
        nodeVersion: string;
        pid: number;
        uptimeSeconds: number;
        timestamp: string;
        database: {
            status: "connected" | "disconnected";
            latencyMs?: number;
        };
        memory: {
            rssMb: number;
            heapUsedMb: number;
            heapTotalMb: number;
        };
    }>;
    private getPackageVersion;
}
