import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Throws an error if response status is not OK.
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Generic API request helper.
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const isFormData =
    typeof FormData !== "undefined" && data instanceof FormData;
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (data !== undefined) {
    if (isFormData) {
      body = data as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Unified query function for React Query.
 */
export function getQueryFn<T>(options: { on401: "returnNull" | "throw" }): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;

  return async ({ queryKey }) => {
    let url = queryKey[0] as string;

    // Handle query params if provided
    const params =
      queryKey.length > 1 && typeof queryKey[1] === "object"
        ? (queryKey[1] as Record<string, any>)
        : undefined;

    if (params) {
      const qp = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          qp.set(key, String(value));
        }
      });

      const sep = url.includes("?") ? "&" : "?";
      const qs = qp.toString();
      if (qs) url = `${url}${sep}${qs}`;
    }

    // Fetch the API
    const res = await fetch(url, {
      credentials: "include",
    });

    // Handle 401 Unauthorized based on options
    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null as unknown as T;
      } else {
        throw new Error("Unauthorized");
      }
    }

    // Throw for other bad responses
    await throwIfResNotOk(res);

    // Parse response safely
    try {
      const data = (await res.json()) as T;
      return data;
    } catch {
      // If not JSON, fallback to text
      const text = await res.text();
      return text as unknown as T;
    }
  };
}

/**
 * Central React Query Client configuration.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: false, // Prevent unwanted reloads
      refetchOnReconnect: true,
      retry: 1, // Retry failed queries once
      staleTime: 15 * 1000, // ✅ Data considered fresh for 15s
      gcTime: 5 * 60 * 1000, // Garbage collect unused queries after 5 mins
    },
    mutations: {
      retry: false,
    },
  },
});
