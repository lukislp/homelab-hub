import type { DashboardData, HealthResponse, StatusResponse } from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = `: ${body.error}`;
    } catch {
      /* non-json error body */
    }
    throw new Error(`HTTP ${res.status}${detail}`);
  }
  return res.json() as Promise<T>;
}

export const getData = () => request<DashboardData>("/api/data");

export const getHealth = () => request<HealthResponse>("/api/health");

export const getStatus = () => request<StatusResponse>("/api/status");

export const putData = (data: DashboardData) =>
  request<{ ok: boolean }>("/api/data", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
