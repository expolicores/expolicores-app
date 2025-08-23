export interface Address {
  id: number;
  label: string;
  recipient: string;
  phone: string;
  line1: string;
  line2?: string;
  neighborhood?: string;
  city: string;
  state: string;
  country: string;
  lat?: number;
  lng?: number;
  notes?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}
