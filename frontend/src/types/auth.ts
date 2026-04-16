export type Role = 'ADMIN' | 'USER' | 'BUSINESS' | 'B2B' | 'B2C';

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: Role;
}

export interface Me {
  id: number;
  email: string;
  role: Role;
  name?: string | null;
  phone?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface AuthTokenResponse {
  token: string;
  userId: number;
  name: string;
  email: string;
}
