import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter
  implements ExceptionFilter<Prisma.PrismaClientKnownRequestError>
{
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    // Mapea códigos -> HttpException
    let httpError: HttpException;

    switch (exception.code) {
      case 'P2025': // Record not found
        httpError = new NotFoundException('NOT_FOUND');
        break;
      case 'P2002': // Unique constraint failed
        // Puedes incluir el campo único en el mensaje si quieres: exception.meta?.target
        httpError = new ConflictException('UNIQUE_CONSTRAINT_VIOLATION');
        break;
      case 'P2003': // Foreign key constraint failed
        httpError = new BadRequestException('FOREIGN_KEY_CONSTRAINT');
        break;
      case 'P2000': // Value too long for column
        httpError = new BadRequestException('VALUE_TOO_LONG');
        break;
      case 'P2016': // Query interpretation error
      case 'P2018': // Required connected records not found
      case 'P2014': // The change you are trying to make would violate...
        httpError = new BadRequestException('INVALID_REQUEST');
        break;
      default:
        // Si no mapeamos, deja que Nest maneje como 500
        httpError = new BadRequestException('PRISMA_ERROR');
        break;
    }

    // Responder
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const status = (httpError.getStatus && httpError.getStatus()) || 400;

    res.status(status).json({
      statusCode: status,
      code: (httpError as any).response?.message || 'ERROR',
      // Info útil para debugging en dev (opcional, NO en prod)
      // prisma: { code: exception.code, meta: exception.meta },
    });
  }
}
