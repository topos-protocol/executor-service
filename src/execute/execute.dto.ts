import { ApiProperty } from '@nestjs/swagger'
import {
  IsEthereumAddress,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator'

export class ExecuteDto {
  @ApiProperty({
    description: 'The id of the receiving subnet',
  })
  @IsNotEmpty()
  @IsString()
  subnetId: string

  @ApiProperty({
    description:
      'The array of indexes that the messaging contract should use to validate the cross-subnet message semantically',
  })
  @IsNotEmpty()
  @IsNumber({}, { each: true })
  logIndexes: number[]

  @ApiProperty({
    description:
      'The root of the receipt trie including the cross-subnet message tx receipt from the sending subnet',
  })
  @IsNotEmpty()
  @IsString()
  receiptTrieRoot: string

  @ApiProperty({
    description:
      'The merkle proof proving the inclusion of the cross-subnet message tx receipt from the sending subnet in the certified receipt trie',
  })
  @IsNotEmpty()
  @IsString()
  receiptTrieMerkleProof: string

  @ApiProperty({
    description: 'The address of the messaging contract',
  })
  @IsNotEmpty()
  @IsEthereumAddress()
  messagingContractAddress: string
}
