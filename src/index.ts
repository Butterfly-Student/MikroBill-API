import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { customerRoutes } from "@/routes/customer.route";
import { routerRoutes } from "@/routes/router.route";
import { errorHandler } from "@/middleware/error.middleware";

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
	.group("/api/v1", (app) => app.use(customerRoutes).use(routerRoutes))
	.get("/", () => ({
		message: "MikroBill API Server",
		version: "1.0.0",
		status: "running",
	}));

app.listen(5000);

console.log(`🦊 MikroBill API is running at http://localhost:5000`);
