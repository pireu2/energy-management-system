/**
 * Custom fetch wrapper that adds ngrok-skip-browser-warning header
 * to bypass ngrok's interstitial warning page
 */
export const apiFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const headers = new Headers(init?.headers || {});

  // Add ngrok bypass header for all requests
  headers.set("ngrok-skip-browser-warning", "true");

  return fetch(input, {
    ...init,
    headers,
  });
};
