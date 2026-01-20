import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { config } from "../config/env";

interface ChatMessage {
  id: number;
  sender_type: "user" | "bot" | "admin" | "ai";
  message: string;
  created_at: string;
  user_id?: number;
}

interface ChatSession {
  id: number;
  session_type: string;
  status: string;
  admin_id?: number;
  user_id?: number;
  user_email?: string;
  message_count?: number;
  last_message?: string;
}

interface Notification {
  type: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface Admin {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

// Store chat history per target (bot or adminId)
interface ChatHistory {
  messages: ChatMessage[];
  session: ChatSession | null;
}

export const ChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [chatMode, setChatMode] = useState<"bot" | "admin">("bot");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [adminRequests, setAdminRequests] = useState<ChatSession[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ChatSession | null>(
    null
  );
  const [adminPanelMessages, setAdminPanelMessages] = useState<ChatMessage[]>(
    []
  );
  // Store chat histories: key is "bot" or "admin-{adminId}"
  const chatHistoriesRef = useRef<Map<string, ChatHistory>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const adminMessagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBottomAdmin = () => {
    adminMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollToBottomAdmin();
  }, [adminPanelMessages]);

  // Helper to get current chat key
  const getCurrentChatKey = useCallback(() => {
    if (chatMode === "bot") return "bot";
    return selectedAdminId ? `admin-${selectedAdminId}` : null;
  }, [chatMode, selectedAdminId]);

  // Save current chat history
  const saveCurrentHistory = useCallback(() => {
    const key = getCurrentChatKey();
    if (key) {
      chatHistoriesRef.current.set(key, {
        messages: [...messages],
        session: session,
      });
    }
  }, [getCurrentChatKey, messages, session]);

  // Load chat history for a key
  const loadHistory = useCallback((key: string) => {
    const history = chatHistoriesRef.current.get(key);
    if (history) {
      setMessages(history.messages);
      setSession(history.session);
      return true;
    }
    return false;
  }, []);

  // Fetch admins list (only for non-admin users)
  useEffect(() => {
    if (user?.role === "admin") return;
    const fetchAdmins = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch(`${config.apiUrl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const adminUsers = data.filter(
            (u: { role: string }) => u.role === "admin"
          );
          setAdmins(adminUsers);
        }
      } catch (error) {
        console.error("Failed to fetch admins:", error);
      }
    };
    fetchAdmins();
  }, [user?.role]);

  // Fetch admin requests if user is admin
  const fetchAdminRequests = useCallback(async () => {
    if (user?.role !== "admin") return;
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${config.apiUrl}/api/chat/admin/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAdminRequests(data);
      }
    } catch (error) {
      console.error("Failed to fetch admin requests:", error);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchAdminRequests();
      const interval = setInterval(fetchAdminRequests, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.role, fetchAdminRequests]);

  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    const ws = new WebSocket(`${config.wsUrl}?token=${token}`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "overconsumption") {
          // Overconsumption notification
          setNotifications((prev) => [
            ...prev,
            {
              type: "overconsumption",
              message: data.message,
              data: data.data,
              timestamp: data.timestamp,
            },
          ]);
        } else if (data.type === "chat") {
          const notifData = data.data || {};

          if (notifData.type === "admin_chat" || notifData.fromAdmin) {
            // Admin sent a message to user
            if (user?.role !== "admin") {
              const newMessage: ChatMessage = {
                id: Date.now(),
                sender_type: "admin",
                message: data.message,
                created_at: new Date().toISOString(),
              };
              // Add to current messages if same session
              if (session && notifData.sessionId === session.id) {
                setMessages((prev) => [...prev, newMessage]);
              }
              // Also add notification
              setNotifications((prev) => [
                ...prev,
                {
                  type: "admin_chat",
                  message: data.message,
                  data: notifData,
                  timestamp: data.timestamp,
                },
              ]);
            }
          } else if (notifData.type === "admin_request") {
            // User requesting admin chat - refresh admin requests
            if (user?.role === "admin") {
              fetchAdminRequests();
              setNotifications((prev) => [
                ...prev,
                {
                  type: "admin_request",
                  message: `New chat request from ${
                    notifData.fromUserEmail || "a user"
                  }`,
                  data: notifData,
                  timestamp: data.timestamp,
                },
              ]);
            }
          } else {
            // Regular chat message (user to admin)
            if (user?.role === "admin") {
              fetchAdminRequests();
              // If viewing this session, add the message
              if (
                selectedRequest &&
                notifData.sessionId === selectedRequest.id
              ) {
                const newMessage: ChatMessage = {
                  id: Date.now(),
                  sender_type: "user",
                  message: data.message,
                  created_at: new Date().toISOString(),
                };
                setAdminPanelMessages((prev) => [...prev, newMessage]);
              }
            }
          }
        }
      } catch {
        console.error("Failed to parse WebSocket message");
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [session, selectedRequest, user?.role, fetchAdminRequests]);

  useEffect(() => {
    if (!wsRef.current) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const fetchSessionMessages = async (
    sessionId: number
  ): Promise<ChatMessage[]> => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${config.apiUrl}/api/chat/sessions/${sessionId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
    return [];
  };

  const startSession = async (
    mode: "bot" | "admin" = "bot",
    adminId: number | null = null
  ) => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${config.apiUrl}/api/chat/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chatMode: mode,
          targetAdminId: mode === "admin" ? adminId : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
        setChatMode(mode);

        // If existing session, load its messages
        if (data.isExisting && data.session?.id) {
          const existingMessages = await fetchSessionMessages(data.session.id);
          setMessages(existingMessages);
        } else {
          setMessages([]);
        }
        return data.session;
      }
    } catch (error) {
      console.error("Failed to start chat session:", error);
    }
    return null;
  };

  const switchToBot = async () => {
    // Save current history
    saveCurrentHistory();

    setChatMode("bot");
    setSelectedAdminId(null);

    // Try to load existing bot history
    const loaded = loadHistory("bot");
    if (!loaded) {
      // Start new bot session
      setMessages([]);
      setSession(null);
    }
  };

  const switchToAdmin = async (adminId: number) => {
    if (!adminId) return;

    // Save current history
    saveCurrentHistory();

    setChatMode("admin");
    setSelectedAdminId(adminId);

    const key = `admin-${adminId}`;
    // Try to load existing admin history
    const loaded = loadHistory(key);
    if (!loaded) {
      // Start new admin session
      setMessages([]);
      setSession(null);
    }
  };

  const handleAdminChange = async (adminId: number | null) => {
    if (adminId === null) {
      setSelectedAdminId(null);
      return;
    }
    await switchToAdmin(adminId);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    if (chatMode === "admin" && !selectedAdminId) return;

    const token = localStorage.getItem("accessToken");
    const userMessage: ChatMessage = {
      id: Date.now(),
      sender_type: "user",
      message: inputMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputMessage;
    setInputMessage("");

    try {
      // Ensure we have a session
      let currentSession = session;
      if (!currentSession) {
        currentSession = await startSession(chatMode, selectedAdminId);
        if (!currentSession) {
          return;
        }
      }

      const response = await fetch(
        `${config.apiUrl}/api/chat/session/${currentSession.id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: messageToSend }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          setMessages((prev) => [...prev, data.response]);
        } else if (data.responseType === "admin_pending") {
          // Message sent to admin, waiting for response
          const waitingMessage: ChatMessage = {
            id: Date.now() + 1,
            sender_type: "bot",
            message: "Message sent to admin. Waiting for response...",
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, waitingMessage]);
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const sendAdminReply = async () => {
    if (!inputMessage.trim() || !selectedRequest) return;

    const token = localStorage.getItem("accessToken");
    const adminMessage: ChatMessage = {
      id: Date.now(),
      sender_type: "admin",
      message: inputMessage,
      created_at: new Date().toISOString(),
    };

    setAdminPanelMessages((prev) => [...prev, adminMessage]);
    const messageToSend = inputMessage;
    setInputMessage("");

    try {
      const response = await fetch(`${config.apiUrl}/api/chat/admin/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: selectedRequest.id,
          message: messageToSend,
        }),
      });

      if (response.ok) {
        fetchAdminRequests();
      }
    } catch (error) {
      console.error("Failed to send admin reply:", error);
    }
  };

  const loadSessionMessages = async (sessionId: number) => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        `${config.apiUrl}/api/chat/sessions/${sessionId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAdminPanelMessages(data);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const selectAdminRequest = async (request: ChatSession) => {
    setSelectedRequest(request);
    await loadSessionMessages(request.id);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showAdminPanel && selectedRequest) {
        sendAdminReply();
      } else {
        sendMessage();
      }
    }
  };

  const dismissNotification = (index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  // For admin users, only show admin panel button, not chat button
  if (user?.role === "admin") {
    return (
      <>
        {/* Notification Bell */}
        <div className="fixed bottom-24 right-6 z-50">
          {notifications.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full w-12 h-12 bg-yellow-500 hover:bg-yellow-600 text-white border-0"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                🔔
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              </Button>

              {showNotifications && (
                <div className="absolute bottom-14 right-0 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border">
                  <div className="p-3 border-b font-semibold">
                    Notifications
                  </div>
                  {notifications.map((notif, index) => (
                    <div
                      key={index}
                      className="p-3 border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => dismissNotification(index)}
                    >
                      <div className="font-medium text-sm text-orange-600">
                        {notif.type === "overconsumption"
                          ? "⚠️ Overconsumption Alert"
                          : notif.type === "admin_request"
                          ? "💬 New Chat Request"
                          : notif.type}
                      </div>
                      <div className="text-sm text-gray-600">
                        {notif.message}
                      </div>
                      {notif.data &&
                        typeof notif.data.currentConsumption !==
                          "undefined" && (
                          <div className="text-xs text-gray-400 mt-1">
                            Current: {String(notif.data.currentConsumption)} kWh
                            | Limit: {String(notif.data.maxAllowed)} kWh
                          </div>
                        )}
                      <div className="text-xs text-gray-400">
                        {new Date(notif.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin Panel Button */}
        <Button
          className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-50 bg-green-600 hover:bg-green-700"
          onClick={() => {
            setShowAdminPanel(!showAdminPanel);
            if (!showAdminPanel) {
              fetchAdminRequests();
            }
          }}
        >
          {showAdminPanel ? "✕" : "💬"}
          {adminRequests.length > 0 && !showAdminPanel && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {adminRequests.length}
            </span>
          )}
        </Button>

        {/* Admin Panel */}
        {showAdminPanel && (
          <Card className="fixed bottom-24 right-6 w-[500px] h-[600px] shadow-xl z-50 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Chat Requests</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              </CardTitle>
            </CardHeader>

            <div className="flex flex-1 overflow-hidden">
              {/* Request List */}
              <div className="w-1/3 border-r overflow-y-auto">
                {adminRequests.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">
                    No pending requests
                  </div>
                ) : (
                  adminRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                        selectedRequest?.id === req.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => selectAdminRequest(req)}
                    >
                      <div className="font-medium text-sm truncate">
                        {req.user_email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {req.last_message || "No messages"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {req.status === "waiting_admin" && (
                          <span className="text-orange-500">● Waiting</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col">
                {selectedRequest ? (
                  <>
                    <div className="p-2 border-b bg-gray-50">
                      <div className="font-medium text-sm">
                        {selectedRequest.user_email}
                      </div>
                      <div className="text-xs text-gray-500">
                        Session #{selectedRequest.id}
                      </div>
                    </div>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                      {adminPanelMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.sender_type === "admin"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.sender_type === "admin"
                                ? "bg-green-500 text-white"
                                : msg.sender_type === "user"
                                ? "bg-blue-100 text-blue-900"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <div className="text-xs font-semibold mb-1 opacity-70">
                              {msg.sender_type === "admin"
                                ? "You"
                                : msg.sender_type === "user"
                                ? "User"
                                : "Bot"}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={adminMessagesEndRef} />
                    </CardContent>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Input
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Type your reply..."
                          className="flex-1"
                        />
                        <Button
                          onClick={sendAdminReply}
                          disabled={!inputMessage.trim()}
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    Select a request to respond
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </>
    );
  }

  // Regular user UI
  return (
    <>
      {/* Notification Bell */}
      <div className="fixed bottom-24 right-6 z-50">
        {notifications.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-12 h-12 bg-yellow-500 hover:bg-yellow-600 text-white border-0"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notifications.length}
              </span>
            </Button>

            {showNotifications && (
              <div className="absolute bottom-14 right-0 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl border">
                <div className="p-3 border-b font-semibold">Notifications</div>
                {notifications.map((notif, index) => (
                  <div
                    key={index}
                    className="p-3 border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => dismissNotification(index)}
                  >
                    <div className="font-medium text-sm text-orange-600">
                      {notif.type === "overconsumption"
                        ? "⚠️ Overconsumption Alert"
                        : notif.type === "admin_chat"
                        ? "💬 Admin Message"
                        : notif.type}
                    </div>
                    <div className="text-sm text-gray-600">{notif.message}</div>
                    {notif.data &&
                      typeof notif.data.currentConsumption !== "undefined" && (
                        <div className="text-xs text-gray-400 mt-1">
                          Current: {String(notif.data.currentConsumption)} kWh |
                          Limit: {String(notif.data.maxAllowed)} kWh
                        </div>
                      )}
                    <div className="text-xs text-gray-400">
                      {new Date(notif.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-50"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!session && !isOpen && chatMode === "bot") {
            startSession("bot");
          }
        }}
      >
        {isOpen ? "✕" : "💬"}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[550px] shadow-xl z-50 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>Support Chat</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              />
            </CardTitle>

            {/* Mode Toggle */}
            <div className="flex gap-2 mt-2">
              <Button
                variant={chatMode === "bot" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => switchToBot()}
              >
                🤖 Bot
              </Button>
              <Button
                variant={chatMode === "admin" ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  if (selectedAdminId) {
                    switchToAdmin(selectedAdminId);
                  } else {
                    setChatMode("admin");
                  }
                }}
              >
                👤 Admin
              </Button>
            </div>

            {/* Admin Selector (when in admin mode) */}
            {chatMode === "admin" && (
              <div className="mt-2">
                <select
                  className="w-full p-2 text-sm border rounded"
                  value={selectedAdminId || ""}
                  onChange={(e) =>
                    handleAdminChange(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                >
                  <option value="">Select an admin...</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.firstName} {admin.lastName} ({admin.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {session && (
              <div className="text-xs text-gray-500 mt-1">
                Mode: {session.session_type} | Status: {session.status}
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm">
                {chatMode === "bot"
                  ? "Start a conversation! Ask about devices, consumption, or any other topic."
                  : selectedAdminId
                  ? "Send a message to start chatting with the admin."
                  : "Please select an admin to chat with."}
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.sender_type === "user"
                      ? "bg-blue-500 text-white"
                      : msg.sender_type === "admin"
                      ? "bg-green-100 text-green-900"
                      : msg.sender_type === "ai"
                      ? "bg-purple-100 text-purple-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.sender_type !== "user" && (
                    <div className="text-xs font-semibold mb-1 opacity-70">
                      {msg.sender_type === "admin"
                        ? "Admin"
                        : msg.sender_type === "ai"
                        ? "AI Assistant"
                        : "Bot"}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  chatMode === "admin" && !selectedAdminId
                    ? "Select an admin first..."
                    : "Type a message..."
                }
                className="flex-1"
                disabled={chatMode === "admin" && !selectedAdminId}
              />
              <Button
                onClick={sendMessage}
                disabled={
                  !inputMessage.trim() ||
                  (chatMode === "admin" && !selectedAdminId)
                }
              >
                Send
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
};
