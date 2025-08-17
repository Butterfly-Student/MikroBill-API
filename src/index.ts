import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { customerRoutes } from "@/routes/customer.route";
import { routerRoutes } from "@/routes/router.route";
import { errorHandler } from "@/middleware/error.middleware";
import { routerHotspotRoutes } from "@/routes/hotspot.route";
import { routerPppoeRoutes } from "@/routes/pppoe.route";
import { initializeVoucherCrons } from "@/utils/mikrotik.utils";
import { routerVoucherRoutes } from "@/routes/voucher.route";

const app = new Elysia()
	.use(cors())
	.use(
		swagger({
			documentation: {
				info: {
					title: "MikroBill API",
					version: "1.0.0",
					description: "MikroTik Billing System API",
				},
			},
		})
	)
	.use(errorHandler)
	.group("/api/mikrobill", (app) =>
		app
			.use(routerPppoeRoutes)
			.use(routerHotspotRoutes)
			.use(routerRoutes)
			.use(customerRoutes)
			.use(routerVoucherRoutes)
	)
	.get("/", () => ({
		message: "MikroBill API Server",
		version: "1.0.0",
		status: "running",
	}));

	initializeVoucherCrons();

app.listen(
	{
		port: 5000,
		hostname: "0.0.0.0",
	},
);

console.log(`🦊 MikroBill API is running at http://localhost:5000`);
