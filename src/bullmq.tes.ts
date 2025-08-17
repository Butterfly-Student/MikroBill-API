import Redis from "ioredis";
import { Queue } from "bullmq";

const connection = new Redis({
	host: "127.0.0.1",
	port: 6379,
	password: "r00t", // kalau pakai password
});

const queue = new Queue("test", { connection });

await queue.add("hello-job", { name: "Casper" });
console.log("✅ Job added!");
