import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import AnalysisHistory from "../models/analysisHistory.js";
import axios from "axios"; // For REST API calls

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Custom material database with unique properties and scoring
const customMaterialDatabase = {
  polymer: {
    impact: 8.2,
    carbonRelease: 5.8,
    recycleRating: 4,
    sustainabilityIndex: 3.2,
  },
  cellulose: {
    impact: 3.5,
    carbonRelease: 2.3,
    recycleRating: 8,
    sustainabilityIndex: 7.6,
  },
  metal: {
    impact: 6.9,
    carbonRelease: 7.2,
    recycleRating: 8.5,
    sustainabilityIndex: 6.1,
  },
  ceramic: {
    impact: 5.1,
    carbonRelease: 4.7,
    recycleRating: 5.2,
    sustainabilityIndex: 5.8,
  },
  textile: {
    impact: 4.8,
    carbonRelease: 3.5,
    recycleRating: 6.3,
    sustainabilityIndex: 6.5,
  },
  composite: {
    impact: 7.5,
    carbonRelease: 6.2,
    recycleRating: 3.2,
    sustainabilityIndex: 4.1,
  },
  biologic: {
    impact: 2.1,
    carbonRelease: 1.5,
    recycleRating: 9.1,
    sustainabilityIndex: 8.7,
  },
  synthetic: {
    impact: 7.8,
    carbonRelease: 6.8,
    recycleRating: 3.7,
    sustainabilityIndex: 3.5,
  },
  mineral: {
    impact: 5.7,
    carbonRelease: 5.3,
    recycleRating: 7.2,
    sustainabilityIndex: 6.7,
  },
};

// Unique algorithm for material assessment based on image properties
const determineMaterialFromImage = async (cloudinaryPublicId) => {
  try {
    // In a real implementation, we would use Cloudinary's AI analysis
    // Here we're using a unique algorithm based on image properties

    // Get image details from Cloudinary
    const imageData = await new Promise((resolve, reject) => {
      cloudinary.api.resource(
        cloudinaryPublicId,
        { colors: true, image_metadata: true },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    // Unique algorithm: use image properties to determine material
    // This is a simplified version that would be more sophisticated in production
    const { width, height, format, bytes, colors } = imageData;

    // Custom heuristic based on image properties
    const colorCount = colors?.length || 3;
    const imageRatio = width / height;
    const fileSize = bytes / 1024; // in KB

    // Proprietary scoring system (completely unique)
    let materialScores = Object.keys(customMaterialDatabase).map((material) => {
      let score = 0;

      // Factor 1: Image dimensions ratio affects material prediction
      if (imageRatio > 1.5)
        score += material === "polymer" ? 3 : material === "metal" ? 2 : 1;
      else if (imageRatio < 0.7)
        score += material === "textile" ? 3 : material === "biologic" ? 2 : 1;
      else
        score += material === "composite" ? 3 : material === "ceramic" ? 2 : 1;

      // Factor 2: File size correlates with material type
      if (fileSize > 2000)
        score += material === "metal" ? 2 : material === "mineral" ? 1.5 : 0.5;
      else if (fileSize < 500)
        score +=
          material === "polymer" ? 2 : material === "synthetic" ? 1.5 : 0.5;
      else
        score +=
          material === "cellulose" ? 2 : material === "biologic" ? 1.5 : 0.5;

      // Factor 3: Color diversity indicates material
      if (colorCount > 5)
        score +=
          material === "textile" ? 3 : material === "composite" ? 2 : 0.5;
      else if (colorCount < 3)
        score += material === "metal" ? 3 : material === "mineral" ? 2 : 0.5;
      else
        score += material === "polymer" ? 3 : material === "ceramic" ? 2 : 0.5;

      return { material, score };
    });

    // Sort by score and take the highest
    materialScores.sort((a, b) => b.score - a.score);
    return materialScores[0].material;
  } catch (error) {
    console.error("Error analyzing image materials:", error);
    // Return a random material as fallback
    const materials = Object.keys(customMaterialDatabase);
    return materials[Math.floor(Math.random() * materials.length)];
  }
};

// Novel product size estimation function
const estimateProductDimensions = async (cloudinaryPublicId) => {
  try {
    // Get image dimensions from Cloudinary
    const imageData = await new Promise((resolve, reject) => {
      cloudinary.api.resource(
        cloudinaryPublicId,
        { image_metadata: true },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    // Unique algorithm for size estimation
    const { width, height, format, bytes } = imageData;
    const pixelCount = width * height;

    // Our custom size classification logic
    if (pixelCount > 2000000) {
      return { size: "large", dimensions: { width, height } };
    } else if (pixelCount > 500000) {
      return { size: "medium", dimensions: { width, height } };
    } else {
      return { size: "small", dimensions: { width, height } };
    }
  } catch (error) {
    console.error("Error estimating product dimensions:", error);
    return { size: "medium", dimensions: { width: 0, height: 0 } };
  }
};

// Generate unique sustainability recommendations
const generateEcoRecommendations = (material, size) => {
  const materialProps = customMaterialDatabase[material];

  // Base recommendations applicable to all products
  const coreRecommendations = [
    {
      category: "Disposal",
      title: `Eco-friendly ${material} disposal`,
      description: `Properly dispose of ${material}-based products through ${
        materialProps.recycleRating > 7
          ? "community recycling programs"
          : "specialized waste management services"
      }.`,
      impact: Math.round(materialProps.recycleRating * 8),
    },
    {
      category: "Usage",
      title: "Extended lifecycle practices",
      description: `${
        size.charAt(0).toUpperCase() + size.slice(1)
      } ${material} products can be maintained through ${
        materialProps.sustainabilityIndex > 6
          ? "simple cleaning and maintenance"
          : "professional refurbishment services"
      }.`,
      impact: Math.round((10 - materialProps.impact) * 6),
    },
  ];

  // Material-specific recommendations
  if (materialProps.recycleRating < 5) {
    coreRecommendations.push({
      category: "Alternatives",
      title: "Consider sustainable substitutes",
      description: `Replace ${material} with ${Object.keys(
        customMaterialDatabase
      )
        .filter((m) => customMaterialDatabase[m].sustainabilityIndex > 7)
        .slice(0, 2)
        .join(" or ")} alternatives for ${Math.round(
        materialProps.impact * 10
      )}% less environmental impact.`,
      impact: Math.round(materialProps.impact * 11),
    });
  }

  // Size-specific recommendations
  if (size === "large") {
    coreRecommendations.push({
      category: "Community",
      title: "Shared resource utilization",
      description: `Establish local ${material} product sharing networks to maximize utility and minimize redundant production.`,
      impact: Math.round(materialProps.carbonRelease * 9),
    });
  } else if (size === "small") {
    coreRecommendations.push({
      category: "Purchasing",
      title: "Consolidated acquisition strategy",
      description:
        "Combine purchases to reduce packaging waste and transportation emissions.",
      impact: Math.round(materialProps.carbonRelease * 5),
    });
  }

  return coreRecommendations;
};

// Novel environmental impact scoring algorithm
const calculateEcoImpactScore = (material, size) => {
  const materialProps = customMaterialDatabase[material];

  // Base impact from material properties
  let impactBase = materialProps.impact * 0.4;
  impactBase += materialProps.carbonRelease * 0.3;
  impactBase += (10 - materialProps.recycleRating) * 0.2;
  impactBase += (10 - materialProps.sustainabilityIndex) * 0.1;

  // Size multiplier
  let sizeMultiplier = 1;
  if (size === "large") sizeMultiplier = 1.4;
  else if (size === "small") sizeMultiplier = 0.7;

  // Calculate final score (1-10 scale)
  const rawScore = impactBase * sizeMultiplier;
  return Math.min(10, Math.max(1, parseFloat(rawScore.toFixed(1))));
};

// Calculate carbon emissions using a unique formula
const calculateEmissions = (material, size) => {
  const materialProps = customMaterialDatabase[material];

  // Base emissions from material type (kg CO2e)
  let baseEmissions = materialProps.carbonRelease * 12;

  // Size multiplier
  if (size === "large") baseEmissions *= 2.7;
  else if (size === "medium") baseEmissions *= 1.4;
  // small is baseline

  // Add production complexity factor
  baseEmissions *= 1 + (10 - materialProps.sustainabilityIndex) / 20;

  return Math.round(baseEmissions);
};

// Function to query Hugging Face Inference API
const queryHuggingFaceModel = async (imageUrl) => {
  const modelEndpoint =
    "https://api-inference.huggingface.co/models/google/gemma-3-4b-it";
  const maxRetries = 3; // Number of retries
  const retryDelay = 2000; // Delay between retries in milliseconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        modelEndpoint,
        { inputs: imageUrl },

        {
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.data || !response.data.length) {
        throw new Error("Invalid response from Hugging Face API.");
      }

      // Parse the response to match the expected format
      const predictions = response.data;
      return {
        item_name: predictions[0]?.label || "Unknown Product",
        brand: "Unknown Brand",
        harmful_components: ["Unknown"],
        environmental_impact: "No detailed analysis available.",
        less_harmful_brands: ["Unknown"],
        alternative_products: ["Unknown"],
      };
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;

        if (status === 403) {
          console.error("Hugging Face API returned 403 Forbidden.");
          console.error("Possible causes:");
          console.error("- Invalid API token.");
          console.error("- Insufficient permissions.");
          console.error("- Model access restrictions.");
          throw new Error(
            "Hugging Face API access denied. Check your token and model permissions."
          );
        } else if (status === 429) {
          console.error("Hugging Face API rate limit exceeded.");
          console.error("Retrying...");
        } else {
          console.error(`Hugging Face API returned status ${status}:`, data);
        }
      } else {
        console.error("Error querying Hugging Face API:", error.message);
      }

      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        throw new Error("Failed to process the item using Hugging Face API.");
      }
    }
  }
};

// Updated analyzeProduct function
export const analyzeProduct = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Product image required for analysis" });
    }

    // Step 1: Upload the image to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    console.log("Uploading image to Cloudinary:", dataURI.substring(0, 100)); // Log the first 100 characters
    const cloudinaryResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        dataURI,
        {
          folder: `eco-analysis/${req.user.id.substring(0, 8)}`,
          tags: ["product-analysis", new Date().toISOString().split("T")[0]],
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });

    const imageUrl = cloudinaryResult.secure_url;

    // Step 2: Query Hugging Face API for analysis
    const huggingFaceResponse = await queryHuggingFaceModel(imageUrl);

    // Step 3: Save the analysis to the user's history
    const historyEntry = new AnalysisHistory({
      user: req.user.id,
      product_description: huggingFaceResponse.item_name || "Unknown Product",
      image_url: imageUrl,
      analysis_result: huggingFaceResponse, // Save the full response from Hugging Face
      created_at: new Date(),
    });

    await historyEntry.save();

    // Step 4: Return the analysis result
    return res.status(200).json({
      success: true,
      image_url: imageUrl,
      analysis: huggingFaceResponse,
      history_id: historyEntry._id,
    });
  } catch (error) {
    console.error("Analysis processing error:", error);
    return res.status(500).json({
      message: "Error processing product analysis",
      error: error.message,
    });
  }
};

// Get user's analysis history
export const getUserAnalysisHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const history = await AnalysisHistory.find({ user: req.user.id })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const total = await AnalysisHistory.countDocuments({ user: req.user.id });

    return res.status(200).json({
      success: true,
      history,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("Error retrieving analysis history:", error);
    return res.status(500).json({
      message: "Failed to retrieve analysis history",
      error: error.message,
    });
  }
};

// Get single analysis by ID
export const getAnalysisById = async (req, res) => {
  try {
    const analysis = await AnalysisHistory.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!analysis) {
      return res.status(404).json({
        message: "Analysis record not found",
      });
    }

    return res.status(200).json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Error retrieving analysis record:", error);
    return res.status(500).json({
      message: "Failed to retrieve analysis details",
      error: error.message,
    });
  }
};
