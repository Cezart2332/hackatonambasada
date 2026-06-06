import type { ProducerProduct, ProducerProfile } from "@prisma/client";

export type ProducerProfileDto = {
  id: string;
  location: string;
  locationChoice: string | null;
  latitude: number | null;
  longitude: number | null;
  rangeKm: number;
  deliveryDays: string;
  products: ProducerProductDto[];
};

export type ProducerProductDto = {
  id: string;
  name: string;
  estimatedQuantity: string;
  unit: string;
  pricePerKg: string;
  availableFrom: string;
};

export function mapProduct(product: ProducerProduct): ProducerProductDto {
  return {
    id: product.id,
    name: product.name,
    estimatedQuantity: product.estimatedQuantity,
    unit: product.unit,
    pricePerKg: product.pricePerKg,
    availableFrom: product.availableFrom,
  };
}

export function mapProfile(
  profile: ProducerProfile & { products: ProducerProduct[] },
): ProducerProfileDto {
  return {
    id: profile.id,
    location: profile.location,
    locationChoice: profile.locationChoice,
    latitude: profile.latitude,
    longitude: profile.longitude,
    rangeKm: profile.rangeKm,
    deliveryDays: profile.deliveryDays,
    products: profile.products.map(mapProduct),
  };
}