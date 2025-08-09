import cron from "node-cron";

cron.schedule("*/5 * * * * *", () => {
	console.log("Task runs every 5 seconds");
});
