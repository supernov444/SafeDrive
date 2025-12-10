console.log("🚀 Starting SafeDrive Backend Server...");
console.log("🧩 Running UPDATED server.mjs version 2.1.0");


import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import userRoutes from "./routes/userRoutes.mjs";
import prototypeRoutes from "./routes/prototypeRoutes.mjs"; // ✅ Added prototype route
import errorHandler from "./middleware/errorHandler.mjs";

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: [
    'https://safedriveapp.flutterflow.app',
    'https://safedrive-api.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`📌 ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ Health Check Endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "✅ SafeDrive Backend API is running!",
    timestamp: new Date().toISOString(),
    version: "2.1.0"
  });
});

// ✅ ROUTES
app.use("/api/users", userRoutes); // User management (login, create, etc.)
app.use("/api", prototypeRoutes);  // Prototype sensor data for dashboard

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

// ✅ Global Error Handler (must be last)
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ MongoDB Connected`);
  console.log(`✅ Server running at: http://localhost:${PORT}`);
  console.log(`🌐 Public (LocalTunnel): ${process.env.PUBLIC_URL || "Not Set"}`);

  // 👇 Final endpoint list
  console.log("\n📚 AVAILABLE ENDPOINTS:");
  console.log("   POST /api/users/operations  → All user operations (login, create, etc.)");
  console.log("   GET  /api/prototype          → Retrieve prototype sensor data for dashboard");
  console.log("\n📌 Ready for FlutterFlow API Calls!");
});

export default app;