"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
exports.getSocketServer = getSocketServer;
exports.getConnectedClients = getConnectedClients;
exports.getClientStreams = getClientStreams;
exports.closeSocketServer = closeSocketServer;
var socket_io_1 = require("socket.io");
var client_1 = require("@/lib/mikrotik/client");
console.log("🧠 socket-server.ts module loaded");
// Global socket server instance
var socketServer = null;
// Client management
var connectedClients = new Map();
var clientStreams = new Map();
// MikroTik configuration
var mikrotikConfig = {
    host: process.env.MIKROTIK_HOST || "192.168.111.1",
    user: process.env.MIKROTIK_USER || "admin",
    password: process.env.MIKROTIK_PASSWORD || "r00t",
    port: parseInt(process.env.MIKROTIK_PORT || "8728"),
    keepalive: true,
    timeout: 10000,
};
function initializeSocketServer(httpServer) {
    var _this = this;
    console.log("🔧 Initializing socket server...");
    if (socketServer) {
        console.log("⚠️  Socket server already initialized");
        return socketServer;
    }
    var io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.NODE_ENV === "production"
                ? ["https://yourdomain.com"]
                : ["http://localhost:3000", "http://127.0.0.1:3000"],
            methods: ["GET", "POST"],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    var mikrotikClient = new client_1.MikrotikClient(mikrotikConfig);
    // Connection event
    io.on("connection", function (socket) {
        var clientInfo = {
            socketId: socket.id,
            connectedAt: new Date(),
            streams: [],
            lastActivity: new Date(),
        };
        connectedClients.set(socket.id, clientInfo);
        clientStreams.set(socket.id, []);
        console.log("\uD83D\uDD0C Client connected: ".concat(socket.id, " (Total: ").concat(connectedClients.size, ")"));
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
        socket.on("ping", function () {
            var client = connectedClients.get(socket.id);
            if (client) {
                client.lastActivity = new Date();
                connectedClients.set(socket.id, client);
            }
            socket.emit("pong", { timestamp: new Date() });
        });
        // Handle IP address stream request
        socket.on("start-ip-stream", function () { return __awaiter(_this, void 0, void 0, function () {
            var streamId, streams, clientInfo_1, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCE1 Starting IP address stream for client: ".concat(socket.id));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mikrotikClient.startIpAddressStream(function (data) {
                                // Emit to specific socket
                                socket.emit("ip-address-update", __assign(__assign({}, data), { timestamp: new Date() }));
                                // Emit to all connected clients
                                io.emit("ip-address-broadcast", __assign(__assign({}, data), { timestamp: new Date(), source: socket.id }));
                            }, function (error) {
                                console.error("\u274C IP address stream error for ".concat(socket.id, ":"), error);
                                socket.emit("error", {
                                    type: "ip-address",
                                    message: "Stream error occurred",
                                    error: error.message,
                                    timestamp: new Date(),
                                });
                            })];
                    case 2:
                        streamId = _a.sent();
                        streams = clientStreams.get(socket.id) || [];
                        streams.push(streamId);
                        clientStreams.set(socket.id, streams);
                        clientInfo_1 = connectedClients.get(socket.id);
                        if (clientInfo_1) {
                            clientInfo_1.streams.push(streamId);
                            clientInfo_1.lastActivity = new Date();
                            connectedClients.set(socket.id, clientInfo_1);
                        }
                        socket.emit("stream-started", {
                            type: "ip-address",
                            streamId: streamId,
                            timestamp: new Date(),
                        });
                        console.log("\u2705 IP address stream started for ".concat(socket.id, ": ").concat(streamId));
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error("\u274C Failed to start IP address stream for ".concat(socket.id, ":"), error_1);
                        socket.emit("error", {
                            type: "ip-address",
                            message: "Failed to start stream",
                            error: error_1 instanceof Error ? error_1.message : "Unknown error",
                            timestamp: new Date(),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // Handle DHCP lease stream request
        socket.on("start-dhcp-stream", function () { return __awaiter(_this, void 0, void 0, function () {
            var streamId, streams, clientInfo_2, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCE1 Starting DHCP lease stream for client: ".concat(socket.id));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mikrotikClient.startDhcpLeasesStream(function (data) {
                                socket.emit("dhcp-lease-update", __assign(__assign({}, data), { timestamp: new Date() }));
                                io.emit("dhcp-lease-broadcast", __assign(__assign({}, data), { timestamp: new Date(), source: socket.id }));
                            }, function (error) {
                                console.error("\u274C DHCP lease stream error for ".concat(socket.id, ":"), error);
                                socket.emit("error", {
                                    type: "dhcp-lease",
                                    message: "Stream error occurred",
                                    error: error.message,
                                    timestamp: new Date(),
                                });
                            })];
                    case 2:
                        streamId = _a.sent();
                        streams = clientStreams.get(socket.id) || [];
                        streams.push(streamId);
                        clientStreams.set(socket.id, streams);
                        clientInfo_2 = connectedClients.get(socket.id);
                        if (clientInfo_2) {
                            clientInfo_2.streams.push(streamId);
                            clientInfo_2.lastActivity = new Date();
                            connectedClients.set(socket.id, clientInfo_2);
                        }
                        socket.emit("stream-started", {
                            type: "dhcp-lease",
                            streamId: streamId,
                            timestamp: new Date(),
                        });
                        console.log("\u2705 DHCP lease stream started for ".concat(socket.id, ": ").concat(streamId));
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error("\u274C Failed to start DHCP lease stream for ".concat(socket.id, ":"), error_2);
                        socket.emit("error", {
                            type: "dhcp-lease",
                            message: "Failed to start stream",
                            error: error_2 instanceof Error ? error_2.message : "Unknown error",
                            timestamp: new Date(),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // Handle interface traffic stream request
        socket.on("start-interface-traffic-stream", function (data) { return __awaiter(_this, void 0, void 0, function () {
            var streamId, streams, clientInfo_3, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCE1 Starting interface traffic stream for client: ".concat(socket.id, ", interface: ").concat(data.interfaceName));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mikrotikClient.streamData(function (streamData) {
                                socket.emit("interface-traffic-update", __assign(__assign({}, streamData), { timestamp: new Date() }));
                                io.emit("interface-traffic-broadcast", __assign(__assign({}, streamData), { timestamp: new Date(), source: socket.id }));
                            }, function (error) {
                                console.error("\u274C Interface traffic stream error for ".concat(socket.id, " (").concat(data.interfaceName, "):"), error);
                                socket.emit("error", {
                                    type: "interface-traffic",
                                    interfaceName: data.interfaceName,
                                    message: "Stream error occurred",
                                    error: error.message,
                                    timestamp: new Date(),
                                });
                            }, "/interface/monitor-traffic", data.interfaceName)];
                    case 2:
                        streamId = _a.sent();
                        streams = clientStreams.get(socket.id) || [];
                        streams.push(streamId);
                        clientStreams.set(socket.id, streams);
                        clientInfo_3 = connectedClients.get(socket.id);
                        if (clientInfo_3) {
                            clientInfo_3.streams.push(streamId);
                            clientInfo_3.lastActivity = new Date();
                            connectedClients.set(socket.id, clientInfo_3);
                        }
                        socket.emit("stream-started", {
                            type: "interface-traffic",
                            interfaceName: data.interfaceName,
                            streamId: streamId,
                            timestamp: new Date(),
                        });
                        console.log("\u2705 Interface traffic stream started for ".concat(socket.id, ": ").concat(streamId, " (").concat(data.interfaceName, ")"));
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error("\u274C Failed to start interface traffic stream for ".concat(socket.id, " (").concat(data.interfaceName, "):"), error_3);
                        socket.emit("error", {
                            type: "interface-traffic",
                            interfaceName: data.interfaceName,
                            message: "Failed to start stream",
                            error: error_3 instanceof Error ? error_3.message : "Unknown error",
                            timestamp: new Date(),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // Handle torch stream request
        socket.on("start-torch-stream", function (data) { return __awaiter(_this, void 0, void 0, function () {
            var interfaceName, streamId, streams, clientInfo_4, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCE1 Starting torch stream for client: ".concat(socket.id));
                        interfaceName = (data === null || data === void 0 ? void 0 : data.interface) || "ether2";
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, mikrotikClient.startTorchStream(interfaceName, function (data) {
                                socket.emit("torch-update", __assign(__assign({}, data), { timestamp: new Date() }));
                                io.emit("torch-broadcast", __assign(__assign({}, data), { timestamp: new Date(), source: socket.id }));
                            }, function (error) {
                                console.error("\u274C Torch stream error for ".concat(socket.id, ":"), error);
                                socket.emit("error", {
                                    type: "torch",
                                    message: "Stream error occurred",
                                    error: error.message,
                                    timestamp: new Date(),
                                });
                            })];
                    case 2:
                        streamId = _a.sent();
                        streams = clientStreams.get(socket.id) || [];
                        streams.push(streamId);
                        clientStreams.set(socket.id, streams);
                        clientInfo_4 = connectedClients.get(socket.id);
                        if (clientInfo_4) {
                            clientInfo_4.streams.push(streamId);
                            clientInfo_4.lastActivity = new Date();
                            connectedClients.set(socket.id, clientInfo_4);
                        }
                        socket.emit("stream-started", {
                            type: "torch",
                            streamId: streamId,
                            interface: interfaceName,
                            timestamp: new Date(),
                        });
                        console.log("\u2705 Torch stream started for ".concat(socket.id, ": ").concat(streamId));
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error("\u274C Failed to start torch stream for ".concat(socket.id, ":"), error_4);
                        socket.emit("error", {
                            type: "torch",
                            message: "Failed to start stream",
                            error: error_4 instanceof Error ? error_4.message : "Unknown error",
                            timestamp: new Date(),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // Handle stop stream request
        socket.on("stop-stream", function (data) {
            var streamId = data.streamId;
            console.log("\uD83D\uDED1 Stopping stream ".concat(streamId, " for client: ").concat(socket.id));
            var success = mikrotikClient.stopStream(streamId);
            if (success) {
                var streams = clientStreams.get(socket.id) || [];
                var updatedStreams = streams.filter(function (id) { return id !== streamId; });
                clientStreams.set(socket.id, updatedStreams);
                var clientInfo_5 = connectedClients.get(socket.id);
                if (clientInfo_5) {
                    clientInfo_5.streams = clientInfo_5.streams.filter(function (id) { return id !== streamId; });
                    clientInfo_5.lastActivity = new Date();
                    connectedClients.set(socket.id, clientInfo_5);
                }
                socket.emit("stream-stopped", {
                    streamId: streamId,
                    timestamp: new Date(),
                });
                console.log("\u2705 Stream ".concat(streamId, " stopped for ").concat(socket.id));
            }
            else {
                console.error("\u274C Failed to stop stream ".concat(streamId, " for ").concat(socket.id));
                socket.emit("error", {
                    type: "stream-control",
                    message: "Failed to stop stream",
                    streamId: streamId,
                    timestamp: new Date(),
                });
            }
        });
        // Handle get client info request
        socket.on("get-client-info", function () {
            var clientInfo = connectedClients.get(socket.id);
            socket.emit("client-info", clientInfo);
        });
        // Handle get server stats request
        socket.on("get-server-stats", function () {
            var stats = {
                totalClients: connectedClients.size,
                totalStreams: Array.from(clientStreams.values()).reduce(function (total, streams) { return total + streams.length; }, 0),
                uptime: process.uptime(),
                timestamp: new Date(),
            };
            socket.emit("server-stats", stats);
        });
        // Handle disconnect
        socket.on("disconnect", function (reason) {
            console.log("\uD83D\uDD0C Client disconnected: ".concat(socket.id, " (Reason: ").concat(reason, ")"));
            // Stop all streams for this client
            var streams = clientStreams.get(socket.id) || [];
            streams.forEach(function (streamId) {
                var success = mikrotikClient.stopStream(streamId);
                if (success) {
                    console.log("\uD83D\uDED1 Stream ".concat(streamId, " stopped due to client disconnect"));
                }
            });
            // Clean up client data
            clientStreams.delete(socket.id);
            connectedClients.delete(socket.id);
            // Broadcast updated client count
            io.emit("client-count", { count: connectedClients.size });
            console.log("\uD83D\uDCCA Remaining clients: ".concat(connectedClients.size));
        });
        // Handle errors
        socket.on("error", function (error) {
            console.error("\u274C Socket error for ".concat(socket.id, ":"), error);
        });
    });
    // Periodic cleanup of inactive clients
    setInterval(function () {
        var now = new Date();
        var inactiveThreshold = 5 * 60 * 1000; // 5 minutes
        for (var _i = 0, _a = connectedClients.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], socketId = _b[0], clientInfo = _b[1];
            var timeSinceActivity = now.getTime() - clientInfo.lastActivity.getTime();
            if (timeSinceActivity > inactiveThreshold) {
                console.log("\uD83E\uDDF9 Cleaning up inactive client: ".concat(socketId));
                var socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                }
            }
        }
    }, 60000); // Check every minute
    socketServer = { io: io, mikrotikClient: mikrotikClient };
    console.log("✅ Socket server initialized successfully");
    return socketServer;
}
function getSocketServer() {
    return socketServer;
}
function getConnectedClients() {
    return connectedClients;
}
function getClientStreams() {
    return clientStreams;
}
// Graceful shutdown
function closeSocketServer() {
    return __awaiter(this, void 0, void 0, function () {
        var _i, _a, _b, socketId, streams, error_5;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!socketServer) return [3 /*break*/, 5];
                    console.log("🛑 Shutting down socket server...");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    // Stop all active streams
                    for (_i = 0, _a = clientStreams.entries(); _i < _a.length; _i++) {
                        _b = _a[_i], socketId = _b[0], streams = _b[1];
                        console.log("\uD83D\uDED1 Stopping ".concat(streams.length, " streams for client ").concat(socketId));
                        streams.forEach(function (streamId) {
                            socketServer.mikrotikClient.stopStream(streamId);
                        });
                    }
                    // Disconnect all clients
                    socketServer.io.emit("server-shutdown", {
                        message: "Server is shutting down",
                        timestamp: new Date(),
                    });
                    // Wait a bit for messages to be sent
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 2:
                    // Wait a bit for messages to be sent
                    _c.sent();
                    // Disconnect MikroTik client
                    return [4 /*yield*/, socketServer.mikrotikClient.disconnect()];
                case 3:
                    // Disconnect MikroTik client
                    _c.sent();
                    console.log("🛑 MikroTik client disconnected");
                    // Close Socket.IO server
                    socketServer.io.close();
                    console.log("🛑 Socket.IO server closed");
                    // Clear data
                    connectedClients.clear();
                    clientStreams.clear();
                    socketServer = null;
                    console.log("✅ Socket server shutdown completed");
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _c.sent();
                    console.error("❌ Error during socket server shutdown:", error_5);
                    throw error_5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
