import { api } from "./client.js";

export interface AdminSummary {
  id: string;
  username: string;
  displayName: string | null;
}

export interface MeResponse {
  admin: AdminSummary;
}

export interface LoginResponse {
  admin: AdminSummary;
}

export const authApi = {
  login(username: string, password: string) {
    return api.post<LoginResponse>("/api/admin/auth/login", { username, password });
  },
  logout() {
    return api.post<void>("/api/admin/auth/logout");
  },
  me() {
    return api.get<MeResponse>("/api/admin/auth/me");
  },
};