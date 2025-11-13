import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export type PushPlatform = 'ios' | 'android';

export class RegisterPushDto {
  @IsString()
  @MinLength(10)
  token!: string; // ej: ExponentPushToken[xxxx...]

  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: PushPlatform;
}

export { PushPlatform as PushPlatformType };
