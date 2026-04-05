/**
 * Maps agent ProposedAction types to encoded contract call parameters.
 * Used by the action execution pipeline to submit approved actions on-chain.
 */

import { encodeFunctionData, parseUnits } from 'viem';
import { TESTNET_ADDRESSES } from './addresses';
import OrderBookABI from './abis/OrderBook.json';
import BuildingRegistryABI from './abis/BuildingRegistry.json';
import type { ProposedAction } from '@/agent/types';

export interface EncodedAction {
  to: `0x${string}`;
  data: `0x${string}`;
  description: string;
}

const RESOURCE_ADDRS = TESTNET_ADDRESSES.contracts.resources;

/**
 * Encode a ProposedAction into a contract call.
 * Returns null if the action can't be encoded (unknown type or missing params).
 */
export function encodeAction(action: ProposedAction): EncodedAction | null {
  const params = action.params;

  switch (action.type) {
    case 'ORDER_PLACE': {
      const resource = params.resource as string | undefined;
      const amount = params.amount as number | undefined;
      const price = params.price as number | undefined;

      if (!resource || !amount || !price) return null;

      const resourceAddr = RESOURCE_ADDRS[resource as keyof typeof RESOURCE_ADDRS] as string | undefined;
      if (!resourceAddr) return null;

      return {
        to: TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`,
        data: encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'placeOrder',
          args: [
            resourceAddr,
            parseUnits(amount.toString(), 18),
            parseUnits(price.toFixed(4), 18),
          ],
        }),
        description: `Place sell order: ${amount} ${resource} @ ${price.toFixed(4)} RATE`,
      };
    }

    case 'ORDER_MATCH': {
      const orderId = params.orderId as number | undefined;
      const fillAmount = (params.fillAmount ?? params.amount) as number | undefined;

      if (orderId === undefined || !fillAmount) return null;

      return {
        to: TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`,
        data: encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'matchOrder',
          args: [
            BigInt(orderId),
            parseUnits(fillAmount.toString(), 18),
          ],
        }),
        description: `Match order #${orderId} for ${fillAmount} units`,
      };
    }

    case 'ORDER_CANCEL': {
      const orderId = params.orderId as number | undefined;
      if (orderId === undefined) return null;

      return {
        to: TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`,
        data: encodeFunctionData({
          abi: OrderBookABI,
          functionName: 'cancelOrder',
          args: [BigInt(orderId)],
        }),
        description: `Cancel order #${orderId}`,
      };
    }

    case 'CLAIM_PRODUCTION': {
      const tokenId = (params.buildingId ?? params.tokenId) as number | undefined;
      if (tokenId === undefined) return null;

      return {
        to: TESTNET_ADDRESSES.contracts.buildingRegistry as `0x${string}`,
        data: encodeFunctionData({
          abi: BuildingRegistryABI,
          functionName: 'claimProduction',
          args: [BigInt(tokenId)],
        }),
        description: `Claim production from building #${tokenId}`,
      };
    }

    default:
      return null;
  }
}
