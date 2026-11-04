import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CheckSetupTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Mật khẩu cần có chữ thường, chữ hoa, số và ký tự đặc biệt.',
  })
  password!: string;
}
