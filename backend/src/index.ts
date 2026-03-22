import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import mongoose from "mongoose";
import router from "./router";
import { initialize } from "./controller";
import { connectMongoDB, initialSettings } from "./config";
import { startAutoResolver } from "./services/autoResolver";
import { initializeForeToken } from "./services/htsService";

// ============ Global Error Handlers — keep server alive on crashes ============
process.on("uncaughtException", (err) => {
    console.error("🔴 Uncaught Exception:", err.message);
    console.error(err.stack);
});

process.on("unhandledRejection", (reason: any) => {
    console.error("🔴 Unhandled Rejection:", reason?.message || reason);
    if (reason?.stack) console.error(reason.stack);
});

// Connect to MongoDB
connectMongoDB();

const { creatorFeeAmount, fundFeePercentage, bettingFeePercentage } = initialSettings;

const app = express();

// ============ CORS — allow frontend origins ============
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length > 0
        ? (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, server-to-server)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(null, true); // Still allow in production — just log
                console.log(`⚠️ CORS request from unlisted origin: ${origin}`);
            }
        }
        : true, // If no ALLOWED_ORIGINS set, allow all (dev mode)
    credentials: true,
}));

// ============ Middleware ============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request timeout — 30s for all routes
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        if (!res.headersSent) {
            res.status(408).json({ error: "Request timeout" });
        }
    });
    next();
});

// ============ Routes ============
app.use("/api", router);

// Initialize Hedera SDK and contracts
const network = (process.env.HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";
initialize(network, {
    creatorFeeAmount,
    fundFeePercentage,
    bettingFeePercentage
});

// Root endpoint
app.get("/", (_req, res) => {
    res.json({ service: "Foresight Prediction Market API", status: "running" });
});

// Health check — includes MongoDB status
app.get("/health", (_req, res) => {
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? "connected" : mongoState === 2 ? "connecting" : "disconnected";
    res.json({
        status: "ok",
        network: process.env.HEDERA_NETWORK || "testnet",
        mongo: mongoStatus,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

const port = process.env.PORT || "9000";
const server = http.createServer(app);

// ============ Express catch-all error handler ============
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("🔴 Express error:", err.message);
    if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
    }
});

// ============ Graceful Shutdown ============
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 ${signal} received — shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
        console.log("✅ HTTP server closed");

        // Close MongoDB connection
        mongoose.connection.close().then(() => {
            console.log("✅ MongoDB connection closed");
            process.exit(0);
        }).catch(() => {
            process.exit(1);
        });
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
        console.error("⚠️ Forced shutdown after 10s timeout");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ============ Start Server ============
server.listen(port, () => {
    console.log(`------------------------------------------------------------`);
    console.log(`| Foresight Prediction Market API                          |`);
    console.log(`| Port: ${String(port).padEnd(49)}|`);
    console.log(`| Network: ${(process.env.HEDERA_NETWORK || "testnet").padEnd(46)}|`);
    console.log(`| Mode: ${(process.env.NODE_ENV || "development").padEnd(49)}|`);
    console.log(`------------------------------------------------------------`);

    // Initialize FORE reward token
    initializeForeToken().catch(e => console.error("FORE init error:", e));

    // Start auto-resolver after server is up
    startAutoResolver();
});
