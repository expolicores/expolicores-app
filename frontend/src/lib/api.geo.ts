import { api } from './api';
import type { GeoValidateRequest, GeoValidateResponse } from '../types/geo';

export async function validateGeo(payload: GeoValidateRequest): Promise<GeoValidateResponse> {
  const { data } = await api.post<GeoValidateResponse>('/geo/validate', payload);
  return data;
}
