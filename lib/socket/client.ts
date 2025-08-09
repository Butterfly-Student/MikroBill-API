// lib/socket-client.ts
import io from "socket.io-client";

export const socket = io("http://localhost:3000", {
	path: "/api/socket/io", // sesuaikan dengan path socket-mu
	autoConnect: false,
});
