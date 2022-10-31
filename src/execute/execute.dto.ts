import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsDefined,
  IsEthereumAddress,
  IsNotEmpty,
  IsObject,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator'

export class CrossSubnetMessage {
  @ApiProperty({
    description: 'The id of a cross-subnet message',
  })
  @IsNotEmpty()
  @IsString()
  id: string

  @ApiProperty({
    description: 'The endpoint of the receiving subnet',
  })
  @IsDefined()
  @IsNotEmpty()
  @IsUrl()
  receivingSubnetEndpoint: string

  @ApiProperty({
    description: 'The address of the contract',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  contractAddress: string

  @ApiProperty({
    description: 'The name of the method to be called',
  })
  @IsNotEmpty()
  @IsString()
  method: string

  @ApiProperty({
    description: 'The arguments passed to the called method',
    required: false,
  })
  @IsNotEmpty()
  @IsArray()
  args: string[]
}

export class ExecuteDto {
  @ApiProperty({
    description: 'The cross-subnet message to be executed',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CrossSubnetMessage)
  crossSubnetMessage: CrossSubnetMessage

  @ApiProperty({
    description:
      'The id of the certificate certifying the cross-subnet message',
  })
  @IsNotEmpty()
  @IsString()
  certId: string

  @ApiProperty({
    description:
      'The inclusion proof of the cross-subnet message in the state transition certified by the certificate',
    type: [Number],
  })
  @IsNotEmpty()
  @IsArray()
  inclusionProof: Uint8Array
}
