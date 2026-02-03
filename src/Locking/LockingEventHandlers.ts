import { TaffyLocking } from "generated";
import { addUser, createLockingSystem } from "./helpers/utils";
import { ADDRESS_ZERO } from "./helpers/constants";

TaffyLocking.Transfer.handler(async ({ event, context }) => {
  let [lock, from, to] = await Promise.all([
    context.Lock.get(event.params.tokenId.toString()),
    context.User.get(event.params.from),
    context.User.get(event.params.to),
  ]);

  let transferType: "mint" | "burn" | "transfer";

  if (event.params.from === ADDRESS_ZERO) {
    transferType = "mint";
  } else if (event.params.to === ADDRESS_ZERO) {
    transferType = "burn";
  } else {
    transferType = "transfer";
  }

  switch (transferType) {
    case "mint":
      if (!to) to = addUser(event.params.to, context);

      if (!lock) {
        lock = {
          id: event.params.tokenId.toString(),
          amount: BigInt(0),
          votingPower: BigInt(0),
          firstEpoch: BigInt(0),
          finalEpoch: BigInt(0),
          isSettled: false,
          txHash: event.transaction.hash,
          user: event.params.to,
        };
      }

      lock = {
        ...lock,
        txHash: event.transaction.hash,
        user: event.params.to,
        isSettled: false,
      };
      break;
    case "burn":
      if (!from) from = addUser(event.params.from, context);
      if (!lock) return;

      lock = {
        ...lock,
        amount: BigInt(0),
        votingPower: BigInt(0),
        isSettled: true,
      };
      break;
    default:
      if (!from) from = addUser(event.params.from, context);
      if (!to) to = addUser(event.params.to, context);
      if (!lock) return;

      lock = {
        ...lock,
        user: event.params.to,
      };
  }

  context.Lock.set(lock);
});

TaffyLocking.Deposit.handler(async ({ event, context }) => {
  let [lockingSystem, lock] = await Promise.all([
    context.LockingSystem.get("1"),
    context.Lock.get(event.params.tokenId.toString()),
  ]);

  if (!lockingSystem) {
    lockingSystem = createLockingSystem(context);
  }

  lockingSystem = {
    ...lockingSystem,
    amountLocked: lockingSystem.amountLocked + event.params.amount,
  };

  context.LockingSystem.set(lockingSystem);

  if (!event.params.provider) addUser(event.params.provider, context);

  if (!lock) {
    lock = {
      id: event.params.tokenId.toString(),
      amount: event.params.amount,
      votingPower: event.params.votingPower,
      firstEpoch: event.params.firstEpoch,
      finalEpoch: event.params.finalEpoch,
      isSettled: false,
      txHash: event.transaction.hash,
      user: event.params.provider,
    };
  }

  context.Lock.set({
    ...lock,
    firstEpoch: event.params.firstEpoch,
    finalEpoch: event.params.finalEpoch,
    amount: event.params.amount,
    votingPower: event.params.votingPower,
  });
});

TaffyLocking.Withdraw.handler(async ({ event, context }) => {
  let lockingSystem = await context.LockingSystem.get("1");

  if (!lockingSystem) {
    lockingSystem = createLockingSystem(context);
  }

  lockingSystem = {
    ...lockingSystem,
    amountLocked: lockingSystem.amountLocked - event.params.value,
  };

  context.LockingSystem.set(lockingSystem);
});
