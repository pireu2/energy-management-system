import React, { useState, useEffect } from "react";
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
  MdDevices,
  MdAssignment,
  MdDevicesOther,
  MdPeople,
  MdTrendingUp,
  MdSettings,
  MdDashboard,
} from "react-icons/md";
import { Link } from "react-router-dom";

interface DashboardStats {
  totalDevices: number;
  assignedDevices: number;
  unassignedDevices: number;
  totalUsers?: number;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    assignedDevices: 0,
    unassignedDevices: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("accessToken");

      const devicesResponse = await fetch(`${config.apiUrl}/api/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (devicesResponse.ok) {
        const devices = await devicesResponse.json();
        const assignedDevices = devices.filter(
          (device: any) => device.assignedUserId
        ).length;

        setStats((prev) => ({
          ...prev,
          totalDevices: devices.length,
          assignedDevices,
          unassignedDevices: devices.length - assignedDevices,
        }));
      }

      if (user?.role === "admin") {
        const usersResponse = await fetch(`${config.apiUrl}/api/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (usersResponse.ok) {
          const users = await usersResponse.json();
          setStats((prev) => ({
            ...prev,
            totalUsers: users.length,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <MdDashboard className="text-2xl" />
          <h2 className="text-3xl font-bold">Dashboard</h2>
        </div>
        <p className="text-blue-100">
          Welcome back, {user?.email}! Here's an overview of your energy
          management
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Devices
            </CardTitle>
            <div className="p-2 bg-blue-100 rounded-full">
              <MdDevices className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalDevices}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total registered devices
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Assigned Devices
            </CardTitle>
            <div className="p-2 bg-green-100 rounded-full">
              <MdAssignment className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.assignedDevices}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Devices assigned to users
            </p>
            {stats.totalDevices > 0 && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (stats.assignedDevices / stats.totalDevices) * 100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Unassigned Devices
            </CardTitle>
            <div className="p-2 bg-orange-100 rounded-full">
              <MdDevicesOther className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {stats.unassignedDevices}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Available for assignment
            </p>
          </CardContent>
        </Card>

        {user?.role === "admin" && (
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Users
              </CardTitle>
              <div className="p-2 bg-purple-100 rounded-full">
                <MdPeople className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {stats.totalUsers}
              </div>
              <p className="text-xs text-gray-500 mt-1">Registered users</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MdTrendingUp className="text-xl text-blue-600" />
              <CardTitle>Quick Actions</CardTitle>
            </div>
            <CardDescription>
              Common tasks and shortcuts to manage your system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 flex flex-col gap-2">
              <Link to="/devices">
                <Button className="w-full justify-start gap-3 h-12 bg-gradient-to-r from-blue-600 to-blue-800">
                  <MdDevices className="text-lg" />
                  <div className="text-left">
                    <div className="font-medium">Manage Devices</div>
                    <div className="text-sm text-white">
                      Add, edit, or assign devices
                    </div>
                  </div>
                </Button>
              </Link>
              {user?.role === "admin" && (
                <Link to="/users">
                  <Button className="w-full justify-start gap-3 h-12 bg-gradient-to-r from-blue-600 to-blue-800">
                    <MdPeople className="text-lg" />
                    <div className="text-left">
                      <div className="font-medium">Manage Users</div>
                      <div className="text-sm text-white">
                        View and manage user accounts
                      </div>
                    </div>
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MdSettings className="text-xl text-gray-600" />
              <CardTitle>System Status</CardTitle>
            </div>
            <CardDescription>
              Current system health and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      System Online
                    </p>
                    <p className="text-xs text-green-600">
                      All services operational
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalDevices}
                  </div>
                  <div className="text-xs text-blue-600">Active Devices</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">100%</div>
                  <div className="text-xs text-purple-600">Uptime</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
