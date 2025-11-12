import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import {
  MdDashboard,
  MdDevices,
  MdPeople,
  MdLogout,
  MdElectricBolt,
  MdAccountCircle,
  MdShowChart,
} from "react-icons/md";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: MdDashboard },
    { path: "/devices", label: "Devices", icon: MdDevices },
    { path: "/monitoring", label: "Energy Monitoring", icon: MdShowChart },
    ...(user?.role === "admin"
      ? [{ path: "/users", label: "Users", icon: MdPeople }]
      : []),
  ];

  return (
    <div className="w-300 min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm w-full">
        <div className="w-full px-4">
          <div className="flex items-center justify-between h-16 max-w-7xl mx-auto">
            <div className="flex items-center space-x-8">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <MdElectricBolt className="text-white text-xl" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Energy Management
                </h3>
              </div>
              <nav className="hidden md:flex space-x-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-blue-100 text-blue-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`
                    }
                  >
                    <item.icon className="text-lg" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                <MdAccountCircle className="text-gray-600 text-lg" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user?.email}</div>
                  <div className="text-xs text-gray-500 capitalize">
                    {user?.role}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <MdLogout className="text-lg" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t bg-white w-full">
          <div className="w-full px-4">
            <div className="flex space-x-1 py-2 overflow-x-auto max-w-7xl mx-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`
                  }
                >
                  <item.icon className="text-lg" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        <div className="container mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  );
};
