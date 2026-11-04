import { Body, Controller, Post } from '@nestjs/common';
import { RegistrationRequestsService } from './registration-requests.service';
import { CreateRegistrationRequestDto } from './dto/create-registration-request.dto';

@Controller('auth')
export class RegistrationRequestsController {
  constructor(
    private readonly registrationRequestsService: RegistrationRequestsService,
  ) {}

  @Post('register')
  register(@Body() body: CreateRegistrationRequestDto) {
    return this.registrationRequestsService.submit(body);
  }
}
