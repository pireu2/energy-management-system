import React, { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { config } from "../config/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  MdShowChart,
  MdBarChart,
  MdCalendarToday,
  MdRefresh,
} from "react-icons/md";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface HourlyConsumption {
  id: number;
  device_id: number;
  user_id: number;
  hour_start: string;
  hour_end: string;
  total_consumption: number;
  measurement_count: number;
}

interface ChartData {
  hour: string;
  consumption: number;
}

export const EnergyMonitoringPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalConsumption, setTotalConsumption] = useState(0);

  useEffect(() => {
    if (user) {
      fetchEnergyData();
    }
  }, [selectedDate, user]);

  const fetchEnergyData = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("accessToken");
      const url = new URL(
        `${config.apiUrl}/api/monitoring/users/${user.id}/consumption`,
      );
      url.searchParams.append("date", selectedDate);

      const response = await apiFetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch energy data");
      }

      const consumptionData: HourlyConsumption[] = await response.json();

      // Transform data for charts
      const transformedData: ChartData[] = [];
      let total = 0;

      // Create data for all 24 hours
      for (let hour = 0; hour < 24; hour++) {
        const hourStart = new Date(selectedDate);
        hourStart.setHours(hour, 0, 0, 0);

        const existingData = consumptionData.find((d) => {
          const dataHour = new Date(d.hour_start);
          return dataHour.getHours() === hour;
        });

        const consumption = existingData
          ? parseFloat(existingData.total_consumption.toString())
          : 0;
        total += consumption;

        transformedData.push({
          hour: `${hour.toString().padStart(2, "0")}:00`,
          consumption: parseFloat(consumption.toFixed(3)),
        });
      }

      setChartData(transformedData);
      setTotalConsumption(parseFloat(total.toFixed(3)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching energy data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleRefresh = () => {
    fetchEnergyData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <MdShowChart className="text-3xl" />
          <h2 className="text-3xl font-bold">Energy Monitoring</h2>
        </div>
        <p className="text-green-100">
          Track your hourly energy consumption and usage patterns
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date and Chart Type</CardTitle>
          <CardDescription>
            Choose a date to view your energy consumption
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MdCalendarToday className="inline mr-2" />
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setChartType("line")}
                variant={chartType === "line" ? "default" : "outline"}
                className="gap-2"
              >
                <MdShowChart />
                Line Chart
              </Button>
              <Button
                onClick={() => setChartType("bar")}
                variant={chartType === "bar" ? "default" : "outline"}
                className="gap-2"
              >
                <MdBarChart />
                Bar Chart
              </Button>
            </div>

            <Button onClick={handleRefresh} variant="outline" className="gap-2">
              <MdRefresh />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Consumption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalConsumption.toFixed(3)} kWh
            </div>
            <p className="text-xs text-gray-500 mt-1">
              For {new Date(selectedDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Hourly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(totalConsumption / 24).toFixed(3)} kWh
            </div>
            <p className="text-xs text-gray-500 mt-1">Per hour average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {chartData.length > 0
                ? chartData.reduce((max, curr) =>
                    curr.consumption > max.consumption ? curr : max,
                  ).hour
                : "N/A"}
            </div>
            <p className="text-xs text-gray-500 mt-1">Highest consumption</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Hourly Energy Consumption</CardTitle>
          <CardDescription>
            Energy usage throughout the day (kWh)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-lg text-gray-600">
                Loading data...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <p className="text-red-600 text-lg mb-2">Error: {error}</p>
                <Button onClick={handleRefresh}>Try Again</Button>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center text-gray-500">
                <p className="text-lg">No data available for this date</p>
                <p className="text-sm mt-2">
                  Try selecting a different date or ensure your devices are
                  sending data
                </p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              {chartType === "line" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    label={{
                      value: "Time of Day",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis
                    label={{
                      value: "Energy (kWh)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toFixed(3)} kWh`,
                      "Consumption",
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="consumption"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ fill: "#16a34a" }}
                    activeDot={{ r: 8 }}
                    name="Energy Consumption"
                  />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    label={{
                      value: "Time of Day",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis
                    label={{
                      value: "Energy (kWh)",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toFixed(3)} kWh`,
                      "Consumption",
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="consumption"
                    fill="#16a34a"
                    name="Energy Consumption"
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
