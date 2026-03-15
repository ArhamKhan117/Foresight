import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
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

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use("/api", router);

// Initialize Hedera SDK and contracts
const network = (process.env.HEDERA_NETWORK as "testnet" | "mainnet") || "testnet";
initialize(network, {
    creatorFeeAmount,
    fundFeePercentage,
    bettingFeePercentage
});

// Root endpoint
app.get("/", (req, res) => {
    res.send("💎 Welcome to Hedera Prediction Market Server! 💎");
});

// Health check
app.get("/health", (req, res) => {
    res.json({ 
        status: "ok", 
        network: process.env.HEDERA_NETWORK || "testnet",
        timestamp: new Date().toISOString()
    });
});

const port = process.env.PORT || "9000";
const server = http.createServer(app);

// Express catch-all error handler — prevents crashes from unhandled route errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("🔴 Express error:", err.message);
    if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
    }
});

server.listen(port, () => {
    console.log(`------------------------------------------------------------`);
    console.log(`|                                                          |`);
    console.log(`| 💎 Hedera Prediction Market Server                       |`);
    console.log(`| 🚀 Running on port ${port}: http://localhost:${port}            |`);
    console.log(`| 🌐 Network: ${(process.env.HEDERA_NETWORK || "testnet").padEnd(42)}|`);
    console.log(`|                                                          |`);
    console.log(`------------------------------------------------------------`);

    // Initialize FORE reward token
    initializeForeToken().catch(e => console.error("FORE init error:", e));

    // Start auto-resolver after server is up
    startAutoResolver();
});
