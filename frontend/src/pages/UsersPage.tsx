import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
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
  MdPeople,
  MdSearch,
  MdAdminPanelSettings,
  MdPerson,
  MdEmail,
  MdDateRange,
  MdCancel,
} from "react-icons/md";

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "client";
  createdAt: string;
  updatedAt: string;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (currentUser?.role !== "admin") {
      window.location.href = "/dashboard";
      return;
    }
    fetchUsers();
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch("/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError("Failed to fetch users");
      }
    } catch (error) {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const userData = {
      email: formData.get("email") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      role: formData.get("role") as "admin" | "client",
    };

    try {
      const token = localStorage.getItem("accessToken");
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";

      const response = await fetch(url, {
        method: editingUser ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        await fetchUsers();
        setShowAddForm(false);
        setEditingUser(null);
        setError("");
      } else {
        const error = await response.json();
        setError(error.error || "Failed to save user");
      }
    } catch (error) {
      setError("Failed to save user");
    }
  };

  const handleDelete = async (userId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? All associated devices will be unassigned."
      )
    )
      return;

    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchUsers();
        setError("");
      } else {
        setError("Failed to delete user");
      }
    } catch (error) {
      setError("Failed to delete user");
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentUser?.role !== "admin") {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MdPeople className="text-2xl text-purple-600" />
            <h2 className="text-3xl font-bold">Users</h2>
          </div>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2"
        >
          <MdAdd className="text-lg" />
          Add User
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-left">Search users by name or email</p>
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm p-4 bg-red-50 rounded-lg border border-red-200">
          <MdCancel className="text-lg" />
          {error}
        </div>
      )}

      {(showAddForm || editingUser) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {editingUser ? (
                <MdEdit className="text-xl text-blue-600" />
              ) : (
                <MdAdd className="text-xl text-green-600" />
              )}
              <CardTitle>
                {editingUser ? "Edit User" : "Add New User"}
              </CardTitle>
            </div>
            <CardDescription>
              {editingUser
                ? "Update user information and role"
                : "Create a new user account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                    <Input
                      id="firstName"
                      name="firstName"
                      required
                      defaultValue={editingUser?.firstName || ""}
                      placeholder="John"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                    <Input
                      id="lastName"
                      name="lastName"
                      required
                      defaultValue={editingUser?.lastName || ""}
                      placeholder="Doe"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    defaultValue={editingUser?.email || ""}
                    placeholder="john.doe@example.com"
                    disabled={!!editingUser}
                  />
                  {editingUser && (
                    <p className="text-xs text-gray-500 mt-1">
                      Email cannot be changed for existing users
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="role">Role</FieldLabel>
                  <select
                    id="role"
                    name="role"
                    required
                    defaultValue={editingUser?.role || "client"}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" className="flex items-center gap-2">
                    {editingUser ? (
                      <MdEdit className="text-lg" />
                    ) : (
                      <MdAdd className="text-lg" />
                    )}
                    {editingUser ? "Update User" : "Create User"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingUser(null);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredUsers.map((user) => (
          <Card
            key={user.id}
            className="hover:shadow-lg transition-all duration-200"
          >
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`p-3 rounded-full ${
                      user.role === "admin" ? "bg-purple-100" : "bg-blue-100"
                    }`}
                  >
                    {user.role === "admin" ? (
                      <MdAdminPanelSettings
                        className={`text-2xl ${
                          user.role === "admin"
                            ? "text-purple-600"
                            : "text-blue-600"
                        }`}
                      />
                    ) : (
                      <MdPerson className="text-2xl text-blue-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {user.firstName} {user.lastName}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MdEmail className="text-gray-400" />
                        <span className="truncate">{user.email}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MdDateRange className="text-gray-400" />
                        <span>
                          Joined {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {user.updatedAt !== user.createdAt && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <MdEdit className="text-gray-400" />
                          <span>
                            Updated{" "}
                            {new Date(user.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingUser(user)}
                    className="flex items-center gap-1"
                  >
                    <MdEdit />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(user.id)}
                    disabled={user.email === currentUser?.email}
                    className="flex items-center gap-1"
                  >
                    <MdDelete />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <MdPeople className="mx-auto text-gray-400 text-4xl mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm
                ? "No users match your search criteria"
                : "No users found"}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 mx-auto"
              >
                <MdAdd />
                Add Your First User
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
