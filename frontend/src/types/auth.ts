export type Role = 'ADMIN' | 'CLIENTE';

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: Role;
}

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { name: string; email: string; password: string; phone: string }

export interface AuthTokenResponse { token: string; userId: number; name: string; email: string }