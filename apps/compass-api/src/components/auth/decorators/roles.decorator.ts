import { SetMetadata } from '@nestjs/common';
import { MemberType } from '../../../libs/enums/member.enum';

export const Roles = (...roles: MemberType[]) => SetMetadata('roles', roles);
