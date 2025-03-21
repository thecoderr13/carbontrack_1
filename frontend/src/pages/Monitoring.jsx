import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Load API key from .env file
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize the generative AI model
const genAI = new GoogleGenerativeAI(API_KEY);

export default function Monitoring() {
  const [chartData, setChartData] = useState({
    temperature: [],
    energy: [],
    water: [],
    co2: [],
  });

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false); // Track AI response status
  const [status, setStatus] = useState(""); // Track the status of the LLM process
  const [timeRange, setTimeRange] = useState("24H"); // Time range for charts

  // Generate time labels based on the selected time range
  const generateTimeLabels = (length) => {
    const labels = [];
    const now = new Date();

    if (timeRange === "1H") {
      for (let i = length - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5000); // 5-second intervals
        labels.push(
          `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`
        );
      }
    } else if (timeRange === "24H") {
      for (let i = length - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5 * 60 * 1000); // 5-minute intervals
        labels.push(
          `${time.getHours()}:${String(time.getMinutes()).padStart(2, "0")}`
        );
      }
    } else {
      for (let i = length - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 24 * 60 * 60 * 1000); // 1-day intervals
        labels.push(
          `${time.toLocaleString("default", {
            month: "short",
          })} ${time.getDate()}`
        );
      }
    }
    return labels;
  };

  // Filter data based on time range
  const filterDataByTimeRange = (data) => {
    if (timeRange === "1H") return data.slice(-12); // Last 12 data points (1 minute)
    if (timeRange === "24H") return data.slice(-288); // Last 288 data points (24 hours)
    return data; // All data for 7D
  };

  // Calculate hourly change and average
  const calculateStats = (data) => {
    if (data.length < 2) return { hourlyChange: 0, average: 0 };
    const hourlyChange = data[data.length - 1] - data[data.length - 2];
    const average = data.reduce((sum, val) => sum + val, 0) / data.length;
    return { hourlyChange, average };
  };

  // Simulate real-time data update
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Updating chart data...");
      setChartData((prevData) => ({
        temperature: [
          ...prevData.temperature.slice(-49),
          20 + Math.random() * 10,
        ],
        energy: [...prevData.energy.slice(-49), 100 + Math.random() * 20],
        water: [...prevData.water.slice(-49), 50 + Math.random() * 10],
        co2: [...prevData.co2.slice(-49), 300 + Math.random() * 50],
      }));
    }, 5000); // Updating every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Format timestamp as "X hours ago", "Yesterday", or "X days ago"
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const responseTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - responseTime) / 1000);
    const diffInHours = Math.floor(diffInSeconds / 3600);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays === 0) {
      if (diffInHours === 0) {
        return "Just now";
      }
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else {
      return `${diffInDays} days ago`;
    }
  };

  // Updated parseLLMResponse function to strip markdown wrappers completely
  const parseLLMResponse = (text) => {
    // Remove all triple backticks and the word "json" if present
    const cleanedText = text.replace(/```(?:json)?/gi, "").trim();
    let parsedData;
    try {
      parsedData = JSON.parse(cleanedText);
    } catch (error) {
      console.error("Failed to parse JSON response:", error);
      return {
        recommendation: cleanedText,
        icon: "ℹ️",
        iconColor: "text-blue-500",
      };
    }

    if (
      parsedData.sensor_data &&
      parsedData.analysis &&
      parsedData.overall_summary
    ) {
      return {
        recommendation: {
          analysis: parsedData.analysis,
          summary: parsedData.overall_summary,
        },
        icon: "📊",
        iconColor: "text-blue-500",
      };
    }

    if (
      parsedData.analysis &&
      parsedData.recommendations &&
      Array.isArray(parsedData.recommendations)
    ) {
      const formattedRecs = parsedData.recommendations
        .map(
          (rec, idx) =>
            `Insight ${idx + 1}: ${rec.insight}\nRecommendation: ${
              rec.recommendation
            }`
        )
        .join("\n\n");
      return {
        recommendation: formattedRecs,
        icon: "💡",
        iconColor: "text-purple-500",
      };
    }

    if (parsedData.insight && parsedData.recommendation) {
      return {
        recommendation: {
          insight: parsedData.insight,
          recommendation: parsedData.recommendation,
        },
        icon: "💡",
        iconColor: "text-purple-500",
      };
    }

    const recommendation =
      parsedData.recommendation || parsedData.message || cleanedText;
    let icon = "ℹ️";
    let iconColor = "text-blue-500";
    if (recommendation.toLowerCase().includes("energy")) {
      icon = "⚡";
      iconColor = "text-yellow-500";
    } else if (recommendation.toLowerCase().includes("co2")) {
      icon = "💨";
      iconColor = "text-gray-500";
    } else if (recommendation.toLowerCase().includes("fluctuating")) {
      icon = "↕️";
      iconColor = "text-orange-500";
    }
    return { recommendation, icon, iconColor };
  };

  // Fetch recommendations from LLM every 5 minutes
  useEffect(() => {
    const fetchRecommendations = async () => {
      // Removed the check for empty CO2 data

      console.log("Fetching recommendations...");
      setLoading(true);
      setStatus("Preparing data for AI analysis...");
      try {
        const inputData = `Analyze the following sensor data and provide recommendations in this exact JSON format with timestamps:
\`\`\`json
{
  "sensor_data": {
    "CO2_Levels": [
      ${chartData.co2
        .slice(-5)
        .map((value, i) => {
          const time = new Date();
          time.setHours(time.getHours() - (4 - i));
          return `{
          "timestamp": "${time.toISOString()}",
          "level": ${value}
        }`;
        })
        .join(",\n      ")}
    ],
    "Energy_Levels": [
      ${chartData.energy
        .slice(-5)
        .map((value, i) => {
          const time = new Date();
          time.setHours(time.getHours() - (4 - i));
          return `{
          "timestamp": "${time.toISOString()}",
          "level": ${value}
        }`;
        })
        .join(",\n      ")}
    ]
  },
  "analysis": [
    {
      "insight": "Detailed analysis of CO2 levels with timestamps",
      "recommendation": "Specific actions for CO2"
    },
    {
      "insight": "Detailed analysis of energy consumption with timestamps",
      "recommendation": "Specific actions for energy"
    }
  ],
  "overall_summary": {
    "insight": "Overall system status summary",
    "recommendation": "Key actions to take"
  }
}\`\`\``;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([inputData]);
        const response = await result.response;
        const text = response.text();

        if (text && !text.includes("⚠️")) {
          console.log("Generated recommendations:", text);
          const timestamp = new Date(); // Store the actual timestamp of the response
          const parsedResponse = parseLLMResponse(text);
          const formattedRecommendation = {
            timestamp,
            recommendation: parsedResponse.recommendation,
            icon: parsedResponse.icon,
            iconColor: parsedResponse.iconColor,
          };
          setRecommendations((prev) => {
            const updatedRecommendations = [...prev, formattedRecommendation];
            return updatedRecommendations.slice(-5); // Keep only the last 5 logs
          });
          setStatus("AI analysis completed.");
        } else {
          console.warn(
            "LLM did not return a valid response or data is insufficient."
          );
          setStatus(
            "AI analysis failed: Insufficient data or invalid response."
          );
        }
      } catch (error) {
        console.error("Error fetching AI recommendations:", error);
        setStatus("Error occurred during AI analysis.");
      } finally {
        setLoading(false);
        console.log("Finished fetching recommendations.");
      }
    };

    // Initial fetch at t = 0 and then every 5 minutes
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Chart data and options for each metric
  const createChartData = (data, color, label) => {
    const filteredData = filterDataByTimeRange(data);
    const labels = generateTimeLabels(filteredData.length);
    return {
      labels,
      datasets: [
        {
          label,
          data: filteredData,
          borderColor: color,
          backgroundColor: `${color}33`, // 20% opacity for fill
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      tooltip: {
        backgroundColor: "#333",
        titleColor: "#fff",
        bodyColor: "#fff",
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${context.parsed.y} at ${context.label}`,
        },
      },
      legend: { display: false },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Time",
          color: "#fff",
        },
        ticks: {
          color: "#fff",
        },
        grid: {
          color: "#d3d3d3", // Light grey grid lines
        },
      },
      y: {
        title: {
          display: true,
          color: "#fff",
        },
        ticks: {
          color: "#fff",
        },
        grid: {
          color: "#d3d3d3", // Light grey grid lines
        },
        beginAtZero: false,
      },
    },
    layout: {
      padding: 10,
    },
    backgroundColor: "#000", // Black background for the chart
  };

  // Calculate stats for each metric
  const tempStats = calculateStats(chartData.temperature);
  const energyStats = calculateStats(chartData.energy);
  const waterStats = calculateStats(chartData.water);
  const co2Stats = calculateStats(chartData.co2);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Real Time Monitoring
      </h1>

      {/* Time Range Toggle */}
      <div className="flex justify-end mb-4 space-x-2">
        <button
          onClick={() => setTimeRange("1H")}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            timeRange === "1H"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Hourly
        </button>
        <button
          onClick={() => setTimeRange("24H")}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            timeRange === "24H"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setTimeRange("7D")}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            timeRange === "7D"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Weekly
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Temperature Card */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🌡️</span>
              <h2 className="text-lg font-semibold">Temperature</h2>
            </div>
            <span
              className={`text-sm font-semibold px-2 py-1 rounded-full ${
                tempStats.hourlyChange >= 0
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {tempStats.hourlyChange >= 0 ? "+" : ""}
              {tempStats.hourlyChange.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold mb-2">
            {chartData.temperature.length > 0
              ? chartData.temperature[chartData.temperature.length - 1].toFixed(
                  1
                )
              : "0.0"}
            °C
          </p>
          <div className="h-40">
            <Line
              data={createChartData(
                chartData.temperature,
                "#FF6F61",
                "Temperature (°C)"
              )}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: { ...chartOptions.scales.y.title, text: "°C" },
                  },
                },
              }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600 flex justify-between">
            <p>
              Hourly Change:{" "}
              <span
                className={`font-bold ${
                  tempStats.hourlyChange >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {tempStats.hourlyChange >= 0 ? "+" : ""}
                {tempStats.hourlyChange.toFixed(1)}°C
              </span>
            </p>
            <p>
              24h Avg:{" "}
              <span className="font-bold">
                {tempStats.average.toFixed(1)}°C
              </span>
            </p>
          </div>
        </div>

        {/* Energy Card */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-2xl mr-2">⚡</span>
              <h2 className="text-lg font-semibold">Energy</h2>
            </div>
            <span
              className={`text-sm font-semibold px-2 py-1 rounded-full ${
                energyStats.hourlyChange >= 0
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {energyStats.hourlyChange >= 0 ? "+" : ""}
              {energyStats.hourlyChange.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold mb-2">
            {chartData.energy.length > 0
              ? chartData.energy[chartData.energy.length - 1].toFixed(1)
              : "0.0"}
            kWh
          </p>
          <div className="h-40">
            <Line
              data={createChartData(
                chartData.energy,
                "#FFC107",
                "Energy (kWh)"
              )}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: { ...chartOptions.scales.y.title, text: "kWh" },
                  },
                },
              }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600 flex justify-between">
            <p>
              Hourly Change:{" "}
              <span
                className={`font-bold ${
                  energyStats.hourlyChange >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {energyStats.hourlyChange >= 0 ? "+" : ""}
                {energyStats.hourlyChange.toFixed(1)} kWh
              </span>
            </p>
            <p>
              24h Avg:{" "}
              <span className="font-bold">
                {energyStats.average.toFixed(1)} kWh
              </span>
            </p>
          </div>
        </div>

        {/* Water Card */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-2xl mr-2">💧</span>
              <h2 className="text-lg font-semibold">Water</h2>
            </div>
            <span
              className={`text-sm font-semibold px-2 py-1 rounded-full ${
                waterStats.hourlyChange >= 0
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {waterStats.hourlyChange >= 0 ? "+" : ""}
              {waterStats.hourlyChange.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold mb-2">
            {chartData.water.length > 0
              ? chartData.water[chartData.water.length - 1].toFixed(1)
              : "0.0"}
            L
          </p>
          <div className="h-40">
            <Line
              data={createChartData(chartData.water, "#42A5F5", "Water (L)")}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: { ...chartOptions.scales.y.title, text: "L" },
                  },
                },
              }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600 flex justify-between">
            <p>
              Hourly Change:{" "}
              <span
                className={`font-bold ${
                  waterStats.hourlyChange >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {waterStats.hourlyChange >= 0 ? "+" : ""}
                {waterStats.hourlyChange.toFixed(1)} L
              </span>
            </p>
            <p>
              24h Avg:{" "}
              <span className="font-bold">
                {waterStats.average.toFixed(1)} L
              </span>
            </p>
          </div>
        </div>

        {/* CO2 Card */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-2xl mr-2">🌿</span>
              <h2 className="text-lg font-semibold">CO2</h2>
            </div>
            <span
              className={`text-sm font-semibold px-2 py-1 rounded-full ${
                co2Stats.hourlyChange >= 0
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {co2Stats.hourlyChange >= 0 ? "+" : ""}
              {co2Stats.hourlyChange.toFixed(1)}%
            </span>
          </div>
          <p className="text-2xl font-bold mb-2">
            {chartData.co2.length > 0
              ? chartData.co2[chartData.co2.length - 1].toFixed(1)
              : "0.0"}
            ppm
          </p>
          <div className="h-40">
            <Line
              data={createChartData(chartData.co2, "#66BB6A", "CO2 (ppm)")}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: { ...chartOptions.scales.y.title, text: "ppm" },
                  },
                },
              }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600 flex justify-between">
            <p>
              Hourly Change:{" "}
              <span
                className={`font-bold ${
                  co2Stats.hourlyChange >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {co2Stats.hourlyChange >= 0 ? "+" : ""}
                {co2Stats.hourlyChange.toFixed(1)} ppm
              </span>
            </p>
            <p>
              24h Avg:{" "}
              <span className="font-bold">
                {co2Stats.average.toFixed(1)} ppm
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* AI Insights & Recommendations */}
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-2">💡</span>
          <h2 className="text-2xl font-bold text-gray-800">
            AI Insights & Recommendations
          </h2>
        </div>
        {status && (
          <p className="text-sm text-gray-500 italic mb-4">{status}</p>
        )}
        <div className="space-y-3">
          {recommendations.length === 0 && !loading ? (
            <p className="text-gray-700">
              No recommendations yet. AI will analyze data soon...
            </p>
          ) : (
            recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-white shadow-sm hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-start space-x-3">
                  <span className={`text-2xl ${rec.iconColor} mt-1`}>
                    {rec.icon}
                  </span>
                  <div className="flex-1">
                    {rec.recommendation &&
                    typeof rec.recommendation === "object" &&
                    rec.recommendation.analysis ? (
                      <div className="space-y-4">
                        {rec.recommendation.analysis.map((item, idx) => (
                          <div
                            key={idx}
                            className="pb-4 border-b border-gray-100 last:border-0"
                          >
                            <div className="text-indigo-600 font-semibold mb-1">
                              Analysis {idx + 1}
                            </div>
                            <div className="mb-2">
                              <span className="text-gray-700 font-medium">
                                Recommendation:
                              </span>
                              <p className="text-gray-600 mt-1">
                                {item.recommendation}
                              </p>
                            </div>
                          </div>
                        ))}
                        {rec.recommendation.summary && (
                          <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                            <div className="text-blue-800 font-semibold mb-2">
                              Overall Summary
                            </div>
                            <div>
                              <span className="text-blue-700 font-medium">
                                Key Actions:
                              </span>
                              <p className="text-blue-600 mt-1">
                                {rec.recommendation.summary.recommendation}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-800">{rec.recommendation}</p>
                    )}
                    <div className="mt-2 text-sm text-gray-500 text-right">
                      {formatTimestamp(rec.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <p className="text-gray-700 flex items-center mt-2">
              <span className="mr-2">⏳</span> AI is analyzing data...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
