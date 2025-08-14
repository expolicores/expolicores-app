import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './update-user.dto';
import { UpdateUserRoleDto } from './update-user-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SelfOrAdminGuard } from '../auth/guards/self-or-admin.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ===== Mi perfil (requiere login) =====
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('id') id: number) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser('id') id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateSelf(id, dto);
  }

  // ===== Admin only =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id/role')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  // ===== Dueño o Admin =====
  @UseGuards(JwtAuthGuard, SelfOrAdminGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, SelfOrAdminGuard)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateSelf(id, dto);
  }
}
