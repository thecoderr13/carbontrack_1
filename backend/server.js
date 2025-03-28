import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import voucherRoutes from "./routes/voucherRoutes.js"; // Use import for ES module
import departmentRoutes from "./routes/departmentRoutes.js";

dotenv.config({});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api", userRoutes); // Ensure this mounts userRoutes at /api
app.use("/api/vouchers", voucherRoutes); // Ensure this matches the frontend API calls
app.use("/api/departments", departmentRoutes); // Ensure this matches the frontend API calls

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Global error handler for uncaught exceptions
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
});

const PORT = process.env.PORT || 5000;
app
  .listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Trying a different port...`
      );
      app.listen(0, () => {
        console.log(`Server running on a random available port`);
      });
    }
  });
