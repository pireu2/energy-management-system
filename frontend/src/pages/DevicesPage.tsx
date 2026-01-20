import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { config } from "../config/env";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Field, FieldLabel, FieldGroup } from "../components/ui/field";
import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdDevices,
  MdAssignment,
  MdAssignmentInd,
  MdSearch,
  MdFilterList,
  MdCheckCircle,
  MdCancel,
  MdLocationOn,
  MdElectricMeter,
  MdSolarPower,
  MdBattery1Bar,
  MdMonitor,
} from "react-icons/md";

interface Device {
  id: number;
  name: string;
  description?: string;
  maximumConsumption: number;
  deviceType: string;
  location?: string;
  isActive: boolean;
  assignedUserId?: number;
  assignedUser?: {
    id: number;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export const DevicesPage: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetchDevices();
    if (user?.role === "admin") {
      fetchUsers();
    }
  }, [user]);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${config.apiUrl}/api/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      } else {
        setError("Failed to fetch devices");
      }
    } catch (error) {
      setError("Failed to fetch devices");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${config.apiUrl}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const deviceData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      maximumConsumption: parseFloat(
        formData.get("maximumConsumption") as string
      ),
      deviceType: formData.get("deviceType") as string,
      location: formData.get("location") as string,
      assignedUserId: formData.get("assignedUserId")
        ? parseInt(formData.get("assignedUserId") as string)
        : undefined,
    };

    try {
      const token = localStorage.getItem("accessToken");
      const url = editingDevice
        ? `${config.apiUrl}/api/devices/${editingDevice.id}`
        : `${config.apiUrl}/api/devices`;

      const response = await fetch(url, {
        method: editingDevice ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deviceData),
      });

      if (response.ok) {
        await fetchDevices();
        setShowAddForm(false);
        setEditingDevice(null);
        setError("");
      } else {
        const error = await response.json();
        setError(error.error || "Failed to save device");
      }
    } catch (error) {
      setError("Failed to save device");
    }
  };

  const handleDelete = async (deviceId: number) => {
    if (!confirm("Are you sure you want to delete this device?")) return;

    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${config.apiUrl}/api/devices/${deviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchDevices();
        setError("");
      } else {
        setError("Failed to delete device");
      }
    } catch (error) {
      setError("Failed to delete device");
    }
  };

  const handleAssignUser = async (deviceId: number, userId: number | null) => {
    try {
      const token = localStorage.getItem("accessToken");
      let response;

      if (userId) {
        response = await fetch(
          `${config.apiUrl}/api/devices/${deviceId}/assign/${userId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        response = await fetch(
          `${config.apiUrl}/api/devices/${deviceId}/assign`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      if (response.ok) {
        await fetchDevices();
        setError("");
      } else {
        setError("Failed to update device assignment");
      }
    } catch (error) {
      setError("Failed to update device assignment");
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "smart_meter":
        return MdElectricMeter;
      case "energy_monitor":
        return MdMonitor;
      case "solar_panel":
        return MdSolarPower;
      case "battery":
        return MdBattery1Bar;
      default:
        return MdDevices;
    }
  };

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "all" ||
      (filterType === "assigned" && device.assignedUserId) ||
      (filterType === "unassigned" && !device.assignedUserId);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading devices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MdDevices className="text-2xl text-blue-600" />
            <h2 className="text-3xl font-bold">Devices</h2>
          </div>
          <p className="text-gray-600">Manage energy monitoring devices</p>
        </div>
        {user?.role === "admin" && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2"
          >
            <MdAdd className="text-lg" />
            Add Device
          </Button>
        )}
      </div>

      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-left">Search devices...</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <MdFilterList className="text-gray-400 text-lg" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="all">All Devices</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm p-4 bg-red-50 rounded-lg border border-red-200">
          <MdCancel className="text-lg" />
          {error}
        </div>
      )}

      {(showAddForm || editingDevice) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {editingDevice ? (
                <MdEdit className="text-xl text-blue-600" />
              ) : (
                <MdAdd className="text-xl text-green-600" />
              )}
              <CardTitle>
                {editingDevice ? "Edit Device" : "Add New Device"}
              </CardTitle>
            </div>
            <CardDescription>
              {editingDevice
                ? "Update device information"
                : "Create a new energy monitoring device"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="name">Device Name</FieldLabel>
                    <Input
                      id="name"
                      name="name"
                      required
                      defaultValue={editingDevice?.name || ""}
                      placeholder="Smart Meter 001"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="deviceType">Device Type</FieldLabel>
                    <select
                      id="deviceType"
                      name="deviceType"
                      required
                      defaultValue={editingDevice?.deviceType || "smart_meter"}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="smart_meter">Smart Meter</option>
                      <option value="energy_monitor">Energy Monitor</option>
                      <option value="solar_panel">Solar Panel</option>
                      <option value="battery">Battery</option>
                    </select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={editingDevice?.description || ""}
                    placeholder="Device description"
                  />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="maximumConsumption">
                      Maximum Consumption (kW)
                    </FieldLabel>
                    <Input
                      id="maximumConsumption"
                      name="maximumConsumption"
                      type="number"
                      step="0.01"
                      required
                      defaultValue={editingDevice?.maximumConsumption || ""}
                      placeholder="100.50"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="location">Location</FieldLabel>
                    <Input
                      id="location"
                      name="location"
                      defaultValue={editingDevice?.location || ""}
                      placeholder="Living Room"
                    />
                  </Field>
                </div>
                {user?.role === "admin" && (
                  <Field>
                    <FieldLabel htmlFor="assignedUserId">
                      Assign to User
                    </FieldLabel>
                    <select
                      id="assignedUserId"
                      name="assignedUserId"
                      defaultValue={editingDevice?.assignedUserId || ""}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="flex gap-2">
                  <Button type="submit" className="flex items-center gap-2">
                    {editingDevice ? (
                      <MdEdit className="text-lg" />
                    ) : (
                      <MdAdd className="text-lg" />
                    )}
                    {editingDevice ? "Update Device" : "Create Device"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingDevice(null);
                    }}
                    className="flex items-center gap-2"
                  >
                    <MdCancel />
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDevices.map((device) => {
          const DeviceIcon = getDeviceIcon(device.deviceType);
          return (
            <Card
              key={device.id}
              className="hover:shadow-lg transition-all duration-200"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DeviceIcon className="text-blue-600 text-xl" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{device.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {device.deviceType.replace("_", " ")}
                      </CardDescription>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      device.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {device.isActive ? <MdCheckCircle /> : <MdCancel />}
                    {device.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {device.description && (
                    <p className="text-sm text-gray-600">
                      {device.description}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <MdElectricMeter className="text-gray-500" />
                      <div>
                        <span className="font-medium">Max Consumption:</span>
                        <div className="text-lg font-bold text-blue-600">
                          {device.maximumConsumption} kW
                        </div>
                      </div>
                    </div>

                    {device.location && (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <MdLocationOn className="text-gray-500" />
                        <div>
                          <span className="font-medium">Location:</span>
                          <div>{device.location}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-3">
                    {device.assignedUser ? (
                      <div className="flex items-center gap-2 text-sm">
                        <MdAssignmentInd className="text-green-600" />
                        <div>
                          <span className="font-medium text-green-700">
                            Assigned to:
                          </span>
                          <div className="text-green-600">
                            {device.assignedUser.email}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MdAssignment className="text-gray-400" />
                        <span>Unassigned</span>
                      </div>
                    )}
                  </div>

                  {user?.role === "admin" && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingDevice(device)}
                        className="flex items-center gap-1"
                      >
                        <MdEdit />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(device.id)}
                        className="flex items-center gap-1"
                      >
                        <MdDelete />
                        Delete
                      </Button>
                      {device.assignedUserId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignUser(device.id, null)}
                          className="flex items-center gap-1"
                        >
                          <MdCancel />
                          Unassign
                        </Button>
                      ) : (
                        <select
                          onChange={(e) => {
                            const userId = parseInt(e.target.value);
                            if (userId) handleAssignUser(device.id, userId);
                          }}
                          className="text-xs border rounded px-2 py-1 bg-white"
                        >
                          <option value="">Assign User</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredDevices.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <MdDevices className="mx-auto text-gray-400 text-4xl mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm || filterType !== "all"
                ? "No devices match your criteria"
                : "No devices found"}
            </p>
            {user?.role === "admin" && !searchTerm && filterType === "all" && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <MdAdd />
                Add Your First Device
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
