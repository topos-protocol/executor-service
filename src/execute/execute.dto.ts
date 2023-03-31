import { ApiProperty } from '@nestjs/swagger'
import {
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsString,
} from 'class-validator'

export class ExecuteDto {
  @ApiProperty({
    description:
      'The raw transaction of a cross-subnet message from the sending subnet',
  })
  @IsNotEmpty()
  @IsString()
  txRaw: string

  @ApiProperty({
    description: 'The index of the data binary in the raw transaction',
  })
  @IsDefined()
  @IsNumber()
  indexOfDataInTxRaw: number

  @ApiProperty({
    description: 'The id of the receiving subnet',
  })
  @IsDefined()
  @IsNotEmpty()
  subnetId: string

  @ApiProperty({
    description:
      'The root of the transaction trie including the cross-subnet message transaction from the sending subnet',
  })
  @IsDefined()
  @IsNotEmpty()
  txTrieRoot: string

  @ApiProperty({
    description:
      'The merkle proof proving the inclusion of the cross-subnet message transaction from the sending subnet in the certified transaction trie',
  })
  @IsDefined()
  @IsNotEmpty()
  txTrieMerkleProof: string

  // @ApiProperty({
  //   description: 'The address of the contract',
  // })
  // @IsNotEmpty()
  // @IsEthereumAddress()
  // contractAddress: string

  // @ApiProperty({
  //   description: 'The name of the method to be called',
  // })
  // @IsNotEmpty()
  // @IsString()
  // method: string

  // @ApiProperty({
  //   description: 'The arguments passed to the called method',
  //   required: false,
  // })
  // @IsNotEmpty()
  // @IsArray()
  // args: string[]
}
