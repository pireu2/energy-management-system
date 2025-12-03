interface ChatRule {
  keywords: string[];
  response: string;
  priority: number;
}

const chatRules: ChatRule[] = [
  {
    keywords: ["hello", "hi", "hey", "greetings"],
    response:
      "Hello! Welcome to Energy Management System support. How can I help you today?",
    priority: 1,
  },
  {
    keywords: ["bye", "goodbye", "thanks", "thank you"],
    response:
      "Thank you for contacting us! If you have any more questions, feel free to ask. Have a great day!",
    priority: 1,
  },
  {
    keywords: ["help", "support", "assist"],
    response:
      "I'm here to help! You can ask me about: device management, energy consumption, account settings, billing, or technical issues. What would you like to know?",
    priority: 2,
  },
  {
    keywords: ["device", "add device", "register device", "new device"],
    response:
      "To add a new device: 1) Go to the Devices page, 2) Click 'Add Device', 3) Fill in the device name and maximum consumption, 4) Click Save. Your device will appear in your dashboard.",
    priority: 3,
  },
  {
    keywords: ["consumption", "energy", "usage", "monitor"],
    response:
      "To monitor your energy consumption: Go to the Energy Monitoring page where you can see real-time consumption data, hourly statistics, and historical trends for all your devices.",
    priority: 3,
  },
  {
    keywords: ["alert", "notification", "overconsumption", "warning"],
    response:
      "Overconsumption alerts are automatically triggered when a device exceeds its maximum consumption limit. You'll receive real-time notifications in the app. Make sure your browser allows notifications.",
    priority: 3,
  },
  {
    keywords: ["password", "change password", "reset password"],
    response:
      "To change your password: Go to Account Settings > Security > Change Password. For password reset, use the 'Forgot Password' link on the login page.",
    priority: 3,
  },
  {
    keywords: ["account", "profile", "settings"],
    response:
      "To manage your account: Click on your profile icon in the top right corner to access account settings, where you can update your email, name, and preferences.",
    priority: 3,
  },
  {
    keywords: ["delete", "remove device"],
    response:
      "To delete a device: Go to Devices page, find the device you want to remove, click the three dots menu, and select 'Delete'. Note: This will also delete all associated consumption data.",
    priority: 3,
  },
  {
    keywords: ["admin", "administrator", "manage users"],
    response:
      "Administrator features include: managing all users, viewing all devices, assigning devices to users, and accessing system-wide analytics. Contact your system administrator for admin access.",
    priority: 3,
  },
  {
    keywords: ["error", "problem", "issue", "not working", "bug"],
    response:
      "I'm sorry you're experiencing issues. Please try: 1) Refreshing the page, 2) Clearing browser cache, 3) Logging out and back in. If the problem persists, please describe the specific error.",
    priority: 4,
  },
  {
    keywords: ["billing", "payment", "invoice", "cost"],
    response:
      "For billing inquiries, please contact our billing department directly at billing@energy-system.com or view your billing history in Account Settings > Billing.",
    priority: 3,
  },
  {
    keywords: ["api", "integration", "developer"],
    response:
      "Our API documentation is available at /api/docs (Swagger). You can integrate with our system using REST APIs. Contact support for API access credentials.",
    priority: 3,
  },
  {
    keywords: ["contact", "email", "phone", "human", "agent", "real person"],
    response:
      "To speak with a human agent, please wait and an administrator will respond to your message shortly. You can also email us at support@energy-system.com.",
    priority: 5,
  },
];

export function findRuleMatch(message: string): string | null {
  const lowerMessage = message.toLowerCase();

  let bestMatch: ChatRule | null = null;
  let bestMatchCount = 0;

  for (const rule of chatRules) {
    const matchCount = rule.keywords.filter((keyword) =>
      lowerMessage.includes(keyword.toLowerCase())
    ).length;

    if (matchCount > 0) {
      if (
        !bestMatch ||
        matchCount > bestMatchCount ||
        (matchCount === bestMatchCount && rule.priority > bestMatch.priority)
      ) {
        bestMatch = rule;
        bestMatchCount = matchCount;
      }
    }
  }

  return bestMatch ? bestMatch.response : null;
}

export function getAllRules(): ChatRule[] {
  return chatRules;
}
