// lib/socket-server.ts
import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { MikrotikClient } from "@/lib/mikrotik/client";
import type { IRosOptions } from "routeros-client";

export interface MikrotikSocketServer {
	io: SocketIOServer;
	mikrotikClient: MikrotikClient;
}

interface ClientInfo {
	socketId: string;
	connectedAt: Date;
	streams: string[];
	lastActivity: Date;
}

console.log("🧠 socket-server.ts module loaded");

// Global socket server instance
let socketServer: MikrotikSocketServer | null = null;

// Client management
const connectedClients = new Map<string, ClientInfo>();
const clientStreams = new Map<string, string[]>();

// MikroTik configuration
const mikrotikConfig: IRosOptions = {
	host: process.env.MIKROTIK_HOST || "192.168.111.1",
	user: process.env.MIKROTIK_USER || "admin",
	password: process.env.MIKROTIK_PASSWORD || "r00t",
	port: parseInt(process.env.MIKROTIK_PORT || "8728"),
	keepalive: true,
	timeout: 10000,
};

export function initializeSocketServer(
	httpServer: HTTPServer
): MikrotikSocketServer {
	console.log("🔧 Initializing socket server...");

	if (socketServer) {
		console.log("⚠️  Socket server already initialized");
		return socketServer;
	}

	const io = new SocketIOServer(httpServer, {
		cors: {
			origin:
				process.env.NODE_ENV === "production"
					? ["https://yourdomain.com"]
					: ["http://localhost:3000", "http://127.0.0.1:3000"],
			methods: ["GET", "POST"],
			credentials: true,
		},
		pingTimeout: 60000,
		pingInterval: 25000,
	});

	const mikrotikClient = new MikrotikClient(mikrotikConfig);

	// Connection event
	io.on("connection", (socket) => {
		const clientInfo: ClientInfo = {
			socketId: socket.id,
			connectedAt: new Date(),
			streams: [],
			lastActivity: new Date(),
		};

		connectedClients.set(socket.id, clientInfo);
		clientStreams.set(socket.id, []);

		console.log(
			`🔌 Client connected: ${socket.id} (Total: ${connectedClients.size})`
		);

		// Send connection status and server info
		socket.emit("connection-status", {
			status: "connected",
			message: "Connected to MikroTik Monitor",
			timestamp: new Date(),
			clientId: socket.id,
			serverInfo: {
				mikrotikHost: mikrotikConfig.host,
				totalClients: connectedClients.size,
			},
		});

		// Broadcast client count to all clients
		io.emit("client-count", { count: connectedClients.size });

		// Handle ping/pong for keepalive
		socket.on("ping", () => {
			const client = connectedClients.get(socket.id);
			if (client) {
				client.lastActivity = new Date();
				connectedClients.set(socket.id, client);
			}
			socket.emit("pong", { timestamp: new Date() });
		});

		// Handle IP address stream request
		socket.on("start-ip-stream", async () => {
			console.log(`📡 Starting IP address stream for client: ${socket.id}`);

			try {
				const streamId = await mikrotikClient.startIpAddressStream(
					(data) => {
						// Emit to specific socket
						socket.emit("ip-address-update", {
							...data,
							timestamp: new Date(),
						});

						// Emit to all connected clients
						io.emit("ip-address-broadcast", {
							...data,
							timestamp: new Date(),
							source: socket.id,
						});
					},
					(error) => {
						console.error(
							`❌ IP address stream error for ${socket.id}:`,
							error
						);
						socket.emit("error", {
							type: "ip-address",
							message: "Stream error occurred",
							error: error.message,
							timestamp: new Date(),
						});
					}
				);

				// Update client streams
				const streams = clientStreams.get(socket.id) || [];
				streams.push(streamId);
				clientStreams.set(socket.id, streams);

				// Update client info
				const clientInfo = connectedClients.get(socket.id);
				if (clientInfo) {
					clientInfo.streams.push(streamId);
					clientInfo.lastActivity = new Date();
					connectedClients.set(socket.id, clientInfo);
				}

				socket.emit("stream-started", {
					type: "ip-address",
					streamId,
					timestamp: new Date(),
				});

				console.log(
					`✅ IP address stream started for ${socket.id}: ${streamId}`
				);
			} catch (error) {
				console.error(
					`❌ Failed to start IP address stream for ${socket.id}:`,
					error
				);
				socket.emit("error", {
					type: "ip-address",
					message: "Failed to start stream",
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date(),
				});
			}
		});

		// Handle DHCP lease stream request
		socket.on("start-dhcp-stream", async () => {
			console.log(`📡 Starting DHCP lease stream for client: ${socket.id}`);

			try {
				const streamId = await mikrotikClient.startDhcpLeasesStream(
					(data) => {
						socket.emit("dhcp-lease-update", {
							...data,
							timestamp: new Date(),
						});

						io.emit("dhcp-lease-broadcast", {
							...data,
							timestamp: new Date(),
							source: socket.id,
						});
					},
					(error) => {
						console.error(
							`❌ DHCP lease stream error for ${socket.id}:`,
							error
						);
						socket.emit("error", {
							type: "dhcp-lease",
							message: "Stream error occurred",
							error: error.message,
							timestamp: new Date(),
						});
					}
				);

				const streams = clientStreams.get(socket.id) || [];
				streams.push(streamId);
				clientStreams.set(socket.id, streams);

				const clientInfo = connectedClients.get(socket.id);
				if (clientInfo) {
					clientInfo.streams.push(streamId);
					clientInfo.lastActivity = new Date();
					connectedClients.set(socket.id, clientInfo);
				}

				socket.emit("stream-started", {
					type: "dhcp-lease",
					streamId,
					timestamp: new Date(),
				});

				console.log(
					`✅ DHCP lease stream started for ${socket.id}: ${streamId}`
				);
			} catch (error) {
				console.error(
					`❌ Failed to start DHCP lease stream for ${socket.id}:`,
					error
				);
				socket.emit("error", {
					type: "dhcp-lease",
					message: "Failed to start stream",
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date(),
				});
			}
		});

		// Handle interface traffic stream request
		socket.on(
			"start-interface-traffic-stream",
			async (data: { interfaceName: string }) => {
				console.log(
					`📡 Starting interface traffic stream for client: ${socket.id}, interface: ${data.interfaceName}`
				);

				try {
					const streamId = await mikrotikClient.streamData(
						(streamData) => {
							socket.emit("interface-traffic-update", {
								...streamData,
								timestamp: new Date(),
							});

							io.emit("interface-traffic-broadcast", {
								...streamData,
								timestamp: new Date(),
								source: socket.id,
							});
						},
						(error) => {
							console.error(
								`❌ Interface traffic stream error for ${socket.id} (${data.interfaceName}):`,
								error
							);
							socket.emit("error", {
								type: "interface-traffic",
								interfaceName: data.interfaceName,
								message: "Stream error occurred",
								error: error.message,
								timestamp: new Date(),
							});
						},
						"/interface/monitor-traffic",
						data.interfaceName
					);

					const streams = clientStreams.get(socket.id) || [];
					streams.push(streamId);
					clientStreams.set(socket.id, streams);

					const clientInfo = connectedClients.get(socket.id);
					if (clientInfo) {
						clientInfo.streams.push(streamId);
						clientInfo.lastActivity = new Date();
						connectedClients.set(socket.id, clientInfo);
					}

					socket.emit("stream-started", {
						type: "interface-traffic",
						interfaceName: data.interfaceName,
						streamId,
						timestamp: new Date(),
					});

					console.log(
						`✅ Interface traffic stream started for ${socket.id}: ${streamId} (${data.interfaceName})`
					);
				} catch (error) {
					console.error(
						`❌ Failed to start interface traffic stream for ${socket.id} (${data.interfaceName}):`,
						error
					);
					socket.emit("error", {
						type: "interface-traffic",
						interfaceName: data.interfaceName,
						message: "Failed to start stream",
						error: error instanceof Error ? error.message : "Unknown error",
						timestamp: new Date(),
					});
				}
			}
		);

		// Handle torch stream request
		socket.on("start-torch-stream", async (data) => {
			console.log(`📡 Starting torch stream for client: ${socket.id}`);
			const interfaceName = data?.interface || "ether2";

			try {
				const streamId = await mikrotikClient.startTorchStream(
					interfaceName,
					(data) => {
						socket.emit("torch-update", {
							...data,
							timestamp: new Date(),
						});

						io.emit("torch-broadcast", {
							...data,
							timestamp: new Date(),
							source: socket.id,
						});
					},
					(error) => {
						console.error(`❌ Torch stream error for ${socket.id}:`, error);
						socket.emit("error", {
							type: "torch",
							message: "Stream error occurred",
							error: error.message,
							timestamp: new Date(),
						});
					}
				);

				const streams = clientStreams.get(socket.id) || [];
				streams.push(streamId);
				clientStreams.set(socket.id, streams);

				const clientInfo = connectedClients.get(socket.id);
				if (clientInfo) {
					clientInfo.streams.push(streamId);
					clientInfo.lastActivity = new Date();
					connectedClients.set(socket.id, clientInfo);
				}

				socket.emit("stream-started", {
					type: "torch",
					streamId,
					interface: interfaceName,
					timestamp: new Date(),
				});

				console.log(`✅ Torch stream started for ${socket.id}: ${streamId}`);
			} catch (error) {
				console.error(
					`❌ Failed to start torch stream for ${socket.id}:`,
					error
				);
				socket.emit("error", {
					type: "torch",
					message: "Failed to start stream",
					error: error instanceof Error ? error.message : "Unknown error",
					timestamp: new Date(),
				});
			}
		});

		// Handle stop stream request
		socket.on("stop-stream", (data) => {
			const { streamId } = data;
			console.log(`🛑 Stopping stream ${streamId} for client: ${socket.id}`);

			const success = mikrotikClient.stopStream(streamId);

			if (success) {
				const streams = clientStreams.get(socket.id) || [];
				const updatedStreams = streams.filter((id) => id !== streamId);
				clientStreams.set(socket.id, updatedStreams);

				const clientInfo = connectedClients.get(socket.id);
				if (clientInfo) {
					clientInfo.streams = clientInfo.streams.filter(
						(id) => id !== streamId
					);
					clientInfo.lastActivity = new Date();
					connectedClients.set(socket.id, clientInfo);
				}

				socket.emit("stream-stopped", {
					streamId,
					timestamp: new Date(),
				});

				console.log(`✅ Stream ${streamId} stopped for ${socket.id}`);
			} else {
				console.error(`❌ Failed to stop stream ${streamId} for ${socket.id}`);
				socket.emit("error", {
					type: "stream-control",
					message: "Failed to stop stream",
					streamId,
					timestamp: new Date(),
				});
			}
		});

		// Handle get client info request
		socket.on("get-client-info", () => {
			const clientInfo = connectedClients.get(socket.id);
			socket.emit("client-info", clientInfo);
		});

		// Handle get server stats request
		socket.on("get-server-stats", () => {
			const stats = {
				totalClients: connectedClients.size,
				totalStreams: Array.from(clientStreams.values()).reduce(
					(total, streams) => total + streams.length,
					0
				),
				uptime: process.uptime(),
				timestamp: new Date(),
			};
			socket.emit("server-stats", stats);
		});

		// Handle disconnect
		socket.on("disconnect", (reason) => {
			console.log(`🔌 Client disconnected: ${socket.id} (Reason: ${reason})`);

			// Stop all streams for this client
			const streams = clientStreams.get(socket.id) || [];
			streams.forEach((streamId) => {
				const success = mikrotikClient.stopStream(streamId);
				if (success) {
					console.log(`🛑 Stream ${streamId} stopped due to client disconnect`);
				}
			});

			// Clean up client data
			clientStreams.delete(socket.id);
			connectedClients.delete(socket.id);

			// Broadcast updated client count
			io.emit("client-count", { count: connectedClients.size });

			console.log(`📊 Remaining clients: ${connectedClients.size}`);
		});

		// Handle errors
		socket.on("error", (error) => {
			console.error(`❌ Socket error for ${socket.id}:`, error);
		});
	});

	// Periodic cleanup of inactive clients
	setInterval(() => {
		const now = new Date();
		const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

		for (const [socketId, clientInfo] of connectedClients.entries()) {
			const timeSinceActivity =
				now.getTime() - clientInfo.lastActivity.getTime();
			if (timeSinceActivity > inactiveThreshold) {
				console.log(`🧹 Cleaning up inactive client: ${socketId}`);
				const socket = io.sockets.sockets.get(socketId);
				if (socket) {
					socket.disconnect(true);
				}
			}
		}
	}, 60000); // Check every minute

	socketServer = { io, mikrotikClient };
	console.log("✅ Socket server initialized successfully");
	return socketServer;
}

export function getSocketServer(): MikrotikSocketServer | null {
	return socketServer;
}

export function getConnectedClients(): Map<string, ClientInfo> {
	return connectedClients;
}

export function getClientStreams(): Map<string, string[]> {
	return clientStreams;
}

// Graceful shutdown
export async function closeSocketServer(): Promise<void> {
	if (socketServer) {
		console.log("🛑 Shutting down socket server...");

		try {
			// Stop all active streams
			for (const [socketId, streams] of clientStreams.entries()) {
				console.log(
					`🛑 Stopping ${streams.length} streams for client ${socketId}`
				);
				streams.forEach((streamId) => {
					socketServer!.mikrotikClient.stopStream(streamId);
				});
			}

			// Disconnect all clients
			socketServer.io.emit("server-shutdown", {
				message: "Server is shutting down",
				timestamp: new Date(),
			});

			// Wait a bit for messages to be sent
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Disconnect MikroTik client
			await socketServer.mikrotikClient.disconnect();
			console.log("🛑 MikroTik client disconnected");

			// Close Socket.IO server
			socketServer.io.close();
			console.log("🛑 Socket.IO server closed");

			// Clear data
			connectedClients.clear();
			clientStreams.clear();

			socketServer = null;
			console.log("✅ Socket server shutdown completed");
		} catch (error) {
			console.error("❌ Error during socket server shutdown:", error);
			throw error;
		}
	}
}
