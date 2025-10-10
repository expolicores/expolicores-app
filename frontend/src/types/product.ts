export type Product = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
};

export type AdminProduct = Product & {
  description?: string | null;
  stock?: number | null;
};
