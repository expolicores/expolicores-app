// backend/src/users/create-feedback.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MinLength(5, { message: 'El comentario es muy corto.' })
  @MaxLength(2000, { message: 'El comentario es muy largo.' })
  message!: string;
}
