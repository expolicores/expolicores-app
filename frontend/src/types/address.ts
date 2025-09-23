export type Address = {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  isDefault: boolean;
  lat?: number | null;   // 👈
  lng?: number | null;   // 👈
  createdAt?: string;
  updatedAt?: string;
};
