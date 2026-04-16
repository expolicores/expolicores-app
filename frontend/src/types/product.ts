export type Product = {
  id: number;
  name: string;
  price: number;
  b2bPrice: number;
  imageUrl?: string | null;
  category?: string | null;
  stock?: number | null;
  description?: string | null;
  isFavorite?: boolean;
};

export interface AdminProduct extends Product {
  description: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}
