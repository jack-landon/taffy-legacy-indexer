import { TaffyFeeManager } from "generated";
import { addUser } from "./helpers/utils";

TaffyFeeManager.FeeClaimed.handler(async ({ event, context }) => {
  let user = await context.User.get(event.params.voter);

  if (!user) {
    addUser(event.params.voter, context);
  }

  context.FeeClaimed.set({
    id: `${event.params.feeToken}-${event.params.epoch}-${event.params.voter}`, // # feeToken + "-" + epoch "-" + claimerAddress
    feeToken: event.params.feeToken,
    epoch_id: event.params.epoch.toString(),
    claimer_id: event.params.voter,
    amount: event.params.amount,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });
});

TaffyFeeManager.FeeRecorded.handler(async ({ event, context }) => {
  context.FeeLogged.set({
    id: `${event.params.feeToken}-${event.params.epoch}`, // # feeToken + "-" + epoch
    feeToken: event.params.feeToken,
    epoch_id: event.params.epoch.toString(),
    amount: event.params.amount,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });
});
