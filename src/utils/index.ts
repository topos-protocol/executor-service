import { JsonFragment } from '@ethersproject/abi'
import { FormatTypes, Interface } from 'ethers/lib/utils'

export function abiToHumanReadableAbi(abi: JsonFragment[]) {
  const iface = new Interface(JSON.stringify(abi))
  return iface.format(FormatTypes.full)
}
