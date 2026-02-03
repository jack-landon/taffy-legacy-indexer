import {
  Epoch,
  handlerContext,
  LockingSystem,
  PoolEpoch,
  User,
  Vote,
} from "generated";
import { ZERO_BI } from "./constants";
import { ZERO_BD } from "../../utils/constants";

export function createLockingSystem(context: handlerContext): LockingSystem {
  const lockingSystem: LockingSystem = {
    id: "1",
    amountLocked: ZERO_BI,
    currentEpoch: ZERO_BI,
  };

  context.LockingSystem.set(lockingSystem);
  return lockingSystem;
}

export function addUser(id: string, context: handlerContext): User {
  const user: User = {
    id,
    unclaimedRewards: BigInt(0),
    claimedRewards: BigInt(0),
    multiplier: BigInt(0),
    usdSwapped: ZERO_BD,
  };

  context.User.set(user);
  return user;
}

export function createEpoch(id: string, context: handlerContext): Epoch {
  let epoch: Epoch = {
    id,
    number: parseInt(id),
    totalVotingPower: ZERO_BI,
    isSettled: false,
    epochEmission: undefined,
  };
  context.Epoch.set(epoch);
  return epoch;
}
