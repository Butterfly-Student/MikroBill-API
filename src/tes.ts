const { RouterOSClient } = require("routeros-client");

const api = new RouterOSClient({
	host: "192.168.100.1",
	user: "admin",
	password: "r00t",
});

async function startMonitoring() {
	try {
		// Connect to RouterOS
		const client = await api.connect();
		console.log("✅ Connected to MikroTik RouterOS");
		console.log("🔄 Starting real-time monitoring...\n");

		// Monitor PPP Active (PPPoE Users)
		const pppMenu = client.menu("/ppp active");
		const pppStream = pppMenu.stream("listen", (err, data) => {
			if (err) {
				console.error("❌ PPP Stream error:", err);
				return;
			}

			console.log("🔵 PPP Active Event:", {
				timestamp: new Date().toISOString(),
				event: "PPP_CHANGE",
				data: data,
			});
		});

		// Monitor DHCP Server Leases
		const dhcpMenu = client.menu("/ip dhcp-server lease");
		const dhcpStream = dhcpMenu.stream("listen", (err, data) => {
			if (err) {
				console.error("❌ DHCP Stream error:", err);
				return;
			}

			console.log("🟢 DHCP Lease Event:", {
				timestamp: new Date().toISOString(),
				event: "DHCP_CHANGE",
				data: data,
			});
		});

		// Monitor Hotspot Active Users
		const hotspotMenu = client.menu("/ip address");
		const hotspotStream = hotspotMenu.stream("listen", (err, data) => {
			if (err) {
				console.error("❌ Hotspot Stream error:", err);
				return;
			}

			console.log("🔴 Hotspot Active Event:", data);
		});

		console.log("📡 All monitors started successfully!");
		console.log("📊 Listening for changes in:");
		console.log("   - PPP Active Users (PPPoE)");
		console.log("   - DHCP Server Leases");
		console.log("   - Hotspot Active Users");
		console.log("\n🔍 Waiting for events...\n");

		// Handle graceful shutdown
		process.on("SIGINT", () => {
			console.log("\n🛑 Shutting down monitors...");

			// Stop all streams
			if (pppStream && typeof pppStream.stop === "function") {
				pppStream.stop();
			}
			if (dhcpStream && typeof dhcpStream.stop === "function") {
				dhcpStream.stop();
			}
			if (hotspotStream && typeof hotspotStream.stop === "function") {
				hotspotStream.stop();
			}

			// Close connection
			api.close();
			console.log("✅ Monitors stopped and connection closed");
			process.exit(0);
		});
	} catch (err) {
		console.error("❌ Connection error:", err);
		console.error(
			"💡 Check your RouterOS credentials and network connectivity"
		);
	}
}

// Optional: Function to get current status (one-time query)
async function getCurrentStatus() {
	try {
		const client = await api.connect();
		console.log("📋 Getting current status...\n");

		// Get current PPP active users
		const pppMenu = client.menu("/ppp active");
		const pppUsers = await pppMenu.get();
		console.log(`🔵 Current PPP Active Users: ${pppUsers.length}`);
		pppUsers.forEach((user, index) => {
			console.log(
				`   ${index + 1}. ${user.name || "Unknown"} - ${
					user.address || "No IP"
				}`
			);
		});

		// Get current DHCP leases
		const dhcpMenu = client.menu("/ip dhcp-server lease");
		const dhcpLeases = await dhcpMenu.where("status", "bound").get();
		console.log(`🟢 Current DHCP Bound Leases: ${dhcpLeases.length}`);
		dhcpLeases.forEach((lease, index) => {
			console.log(
				`   ${index + 1}. ${lease.address || "No IP"} - ${
					lease["mac-address"] || "No MAC"
				}`
			);
		});

		// Get current hotspot active users
		const hotspotMenu = client.menu("/ip hotspot active");
		const hotspotUsers = await hotspotMenu.get();
		console.log(`🔴 Current Hotspot Active Users: ${hotspotUsers.length}`);
		hotspotUsers.forEach((user, index) => {
			console.log(
				`   ${index + 1}. ${user.user || "Unknown"} - ${
					user.address || "No IP"
				}`
			);
		});

		console.log("\n🔄 Starting real-time monitoring...\n");

		// Don't close connection, keep it for monitoring
		return client;
	} catch (err) {
		console.error("❌ Error getting current status:", err);
		throw err;
	}
}

// Main execution
async function main() {
	console.log("🚀 MikroTik Real-time Monitor Starting...\n");

	// Uncomment the line below if you want to see current status first
	// await getCurrentStatus();

	// Start monitoring
	await startMonitoring();
}

// Start the monitoring
main().catch((err) => {
	console.error("❌ Fatal error:", err);
	process.exit(1);
});

// Export for use as module
module.exports = {
	startMonitoring,
	getCurrentStatus,
	api,
};
