import { IRosOptions, RouterOSClient } from "routeros-client";

export class MikrotikClient {
	private client: RouterOSClient;
	private connectedApi!: Awaited<ReturnType<RouterOSClient["connect"]>>;

	constructor(private config: IRosOptions) {
		this.client = new RouterOSClient({
			host: config.host,
			user: config.user,
			password: config.password,
			port: config.port || 8728,
			keepalive: config.keepalive ?? true,
			timeout: 10000,
		});
	}

	async connect(): Promise<void> {
		this.connectedApi = await this.client.connect();
	}

	async disconnect(): Promise<void> {
		await this.client.close();
	}

	async getIdentity(): Promise<any> {
		return this.connectedApi.menu("/system/identity").getOnly();
	}

	async runCommand(path: string): Promise<any[]> {
		return this.connectedApi.menu(path).get();
	}

	async streamTorch(
		interfaceName: string,
		callback: (data: any) => void
	): Promise<void> {
		const torch = this.connectedApi.menu("/tool/torch");
		torch.stream({ interface: interfaceName }, (err, data) => {
			if (err) {
				console.error("Streaming error:", err);
				return;
			}
			callback(data);
		});
	}
}

