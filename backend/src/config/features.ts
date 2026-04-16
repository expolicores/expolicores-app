import { registerAs } from '@nestjs/config';
export default registerAs('features', () => ({
  b2b: process.env.FEATURE_B2B === 'true',
}));
