import { ApiProperty } from '@nestjs/swagger'
import {
  IsArray,
  IsEthereumAddress,
  IsNotEmpty,
  IsObject,
  IsString,
} from 'class-validator'

class CrossSubnetMessage {
  @ApiProperty({
    description: 'The id of a cross-subnet message',
  })
  @IsNotEmpty()
  @IsString()
  id: string

  @ApiProperty({
    description: 'The endpoint of the receiving subnet',
  })
  @IsNotEmpty()
  @IsString()
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
  })
  @IsNotEmpty()
  @IsArray()
  args: string[]
}

export class ExecuteDto {
  @ApiProperty({
    description: 'The cross-subnet message to be executed',
  })
  @IsNotEmpty()
  @IsObject()
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
