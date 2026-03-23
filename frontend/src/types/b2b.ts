export type Role = 'ADMIN' | 'B2C' | 'B2B';
export type BusinessVerificationStatus = 'NONE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type AdminProcessStatus = 'PENDING' | 'IN_PROGRESS' | 'ATTENDED';

export interface MeB2B {
  id: number;
  name?: string;
  phone: string;
  email?: string | null;
  role: Role;
  businessVerificationStatus: BusinessVerificationStatus;
  adminProcessStatus: AdminProcessStatus;
  createdAt?: string;
  updatedAt?: string;
}
