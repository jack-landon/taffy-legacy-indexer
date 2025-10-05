import {
  updatePairDayData,
  updatePairHourData,
  updateTokenDayData,
  updateFactoryDayData,
} from "./dayUpdates";
import { BigDecimal, Burn, Mint, Swap, TaffyPair } from "generated";
import { convertTokenToDecimal, isAddress } from "../utils/helpers";
import {
  findEthPerToken,
  getEthPriceInUSD,
  getTrackedLiquidityUSD,
  getTrackedVolumeUSD,
} from "./pricing";
import {
  ADDRESS_ZERO,
  FACTORY_ADDRESS,
  USDC_WETH_PAIR,
  ONE_BI,
  ZERO_BD,
  BI_18,
} from "../utils/constants";

// Swap, Sync and Transfer Events are causing the problems
TaffyPair.Transfer.handler(async ({ event, context }) => {
  let [factory, pair, transaction] = await Promise.all([
    context.Factory.get(FACTORY_ADDRESS),
    context.Pair.get(event.srcAddress),
    context.Transaction.get(event.transaction.hash),
  ]);

  // ignore initial transfers for first adds
  if (
    event.params.to == ADDRESS_ZERO &&
    BigInt(event.params.value) == BigInt("1000")
  )
    return;

  // user stats
  let from = event.params.from;
  let to = event.params.to;

  if (isAddress(from) && isAddress(to)) {
    // Create from and to users
    let fromUser = await context.User.get(from);
    let toUser = await context.User.get(to);

    if (!fromUser) {
      fromUser = {
        id: from,
        usdSwapped: ZERO_BD,
      };
      context.User.set(fromUser);
    }
    if (!toUser) {
      toUser = {
        id: to,
        usdSwapped: ZERO_BD,
      };
      context.User.set(toUser);
    }
  }

  if (!pair) return; // added from async

  // liquidity token amount being transfered -> Uses BI_18 because the LP token has 18 decimals
  let value = convertTokenToDecimal(event.params.value, BI_18);

  if (!transaction) {
    transaction = {
      id: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      mints: [],
      burns: [],
      swaps: [],
    };
  }

  // mints
  let mints = transaction.mints;
  // part of the erc-20 standard (which is also the pool), whenever you mint new tokens, the from address is 0x0..0
  // the pool is also the erc-20 that gets minted and transferred around
  if (from == ADDRESS_ZERO) {
    // update total supply
    pair = {
      ...pair,
      totalSupply: pair.totalSupply.plus(value),
    };
    context.Pair.set(pair);

    // create new mint if no mints so far or if last one is done already
    // transfers and mints come in pairs, but there could be a case where that doesn't happen and it might break
    // this is to make sure all the mints are under the same transaction
    let lastIndexedMint = await context.Mint.get(mints[mints.length - 1]);
    let isCompleteMint = lastIndexedMint ? true : false;

    if (mints.length === 0 || isCompleteMint) {
      let mint: Mint = {
        id: event.transaction.hash.concat("-").concat(mints.length.toString()),
        transaction_id: transaction.id,
        pair_id: pair.id,
        to: to,
        liquidity: value,
        timestamp: transaction.timestamp,
        amount0: undefined,
        amount1: undefined,
        amountUSD: undefined,
        feeLiquidity: undefined,
        feeTo: undefined,
        logIndex: undefined,
        sender: undefined,
      };

      context.Mint.set(mint);

      // update mints in transaction
      transaction = {
        ...transaction,
        mints: mints.concat([mint.id]),
      };

      // save entities
      context.Transaction.set(transaction);
      if (!factory) return; // added from async
      context.Factory.set(factory);
    }
  }

  // case where direct send first on ETH withdrawls
  // for every burn event, there is a transfer first from the LP to the pool (erc-20)
  // when you LP, you get an ERC-20 token which is the accounting token of the LP position
  // the thing that's actually getting transfered is the LP account token
  if (event.params.to == pair.id) {
    let burns = transaction.burns;
    let burn: Burn = {
      id: event.transaction.hash.concat("-").concat(burns.length.toString()),
      transaction_id: transaction.id,
      pair_id: pair.id,
      liquidity: value,
      timestamp: transaction.timestamp,
      to: event.params.to,
      sender: event.params.from,
      needsComplete: true,
      amount0: undefined,
      amount1: undefined,
      amountUSD: undefined,
      feeLiquidity: undefined,
      feeTo: undefined,
      logIndex: undefined,
    };

    context.Burn.set(burn);

    // TODO: Consider using .concat() for handling array updates to protect
    // against unintended side effects for other code paths.
    burns.push(burn.id);
    transaction = {
      ...transaction,
      burns: burns,
    };

    context.Transaction.set(transaction);
  }

  // burn
  // there's two transfers for the LP token,
  // first its going to move from the LP back to the pool, and then it will go from the pool to the zero address
  if (event.params.to == ADDRESS_ZERO && event.params.from == pair.id) {
    pair = {
      ...pair,
      totalSupply: pair.totalSupply.minus(value),
    };

    context.Pair.set(pair);

    // this is a new instance of a logical burn
    let burns = transaction.burns;
    let burn: Burn;
    // this block creates the burn or gets the reference to it if it already exists
    if (burns.length > 0) {
      let currentBurn = await context.Burn.get(burns[burns.length - 1])!;

      if (!currentBurn) return; // added from async

      if (currentBurn.needsComplete) {
        burn = currentBurn;
      } else {
        burn = {
          id: event.transaction.hash
            .concat("-")
            .concat(burns.length.toString()),
          transaction_id: transaction.id,
          needsComplete: false,
          pair_id: pair.id,
          liquidity: value,
          timestamp: transaction.timestamp,
          amount0: undefined,
          amount1: undefined,
          amountUSD: undefined,
          feeLiquidity: undefined,
          feeTo: undefined,
          logIndex: undefined,
          sender: undefined,
          to: undefined,
        };
      }
    } else {
      burn = {
        id: event.transaction.hash.concat("-").concat(burns.length.toString()),
        transaction_id: transaction.id,
        needsComplete: false,
        pair_id: pair.id,
        liquidity: value,
        timestamp: transaction.timestamp,
        amount0: undefined,
        amount1: undefined,
        amountUSD: undefined,
        feeLiquidity: undefined,
        feeTo: undefined,
        logIndex: undefined,
        sender: undefined,
        to: undefined,
      };
    }

    // if this logical burn included a fee mint, account for this
    // what is a fee mint?
    // how are fees collected on v2?
    // when you're an LP in v2, you're earning fees in terms of LP tokens, so when you go to burn your position, burn and collect fees at the same time
    // protocol is sending the LP something and we think it's a mint when it's not and it's really fees
    let lastIndexedMint = await context.Mint.get(mints[mints.length - 1]);
    let isCompleteMint = lastIndexedMint ? true : false;

    if (mints.length !== 0 && !isCompleteMint) {
      let mint = await context.Mint.get(mints[mints.length - 1])!;
      if (!mint) return; // Added from async
      burn = {
        ...burn,
        feeTo: mint.to,
        feeLiquidity: mint.liquidity,
      };

      // remove the logical mint
      context.Mint.deleteUnsafe(mints[mints.length - 1]);
      // update the transaction

      // TODO: Consider using .slice().pop() to protect against unintended
      // side effects for other code paths.
      mints.pop();
      transaction = {
        ...transaction,
        mints: mints,
      };
      context.Transaction.set(transaction);
    }
    // when you collect fees or burn liquidity what are the events that get triggered
    // not sure why this replaced the last one instead of updating
    context.Burn.set(burn);
    // if accessing last one, replace it
    if (burn.needsComplete) {
      // TODO: Consider using .slice(0, -1).concat() to protect against
      // unintended side effects for other code paths.
      burns[burns.length - 1] = burn.id;
    }
    // else add new one
    else {
      // TODO: Consider using .concat() for handling array updates to protect
      // against unintended side effects for other code paths.
      burns.push(burn.id);
    }
    transaction = {
      ...transaction,
      burns: burns,
    };
    context.Transaction.set(transaction);
  }

  context.Transaction.set(transaction);
});

TaffyPair.Sync.handler(async ({ event, context }) => {
  let [pair, factory, bundle, usdcPair] = await Promise.all([
    context.Pair.get(event.srcAddress),
    context.Factory.get(FACTORY_ADDRESS),
    context.Bundle.get("1"),
    context.Pair.get(USDC_WETH_PAIR),
  ]);

  if (!factory || !pair) return;

  let [token0, token1] = await Promise.all([
    context.Token.get(pair.token0_id),
    context.Token.get(pair.token1_id),
  ]);

  if (!token0 || !token1) return;

  // reset factory liquidity by subtracting onluy tarcked liquidity
  factory = {
    ...factory,
    totalLiquidityETH: factory.totalLiquidityETH.minus(pair.trackedReserveETH),
  };

  // reset token total liquidity amounts
  token0 = {
    ...token0,
    totalLiquidity: token0.totalLiquidity.minus(pair.reserve0),
  };

  token1 = {
    ...token1,
    totalLiquidity: token1.totalLiquidity.minus(pair.reserve1),
  };

  pair = {
    ...pair,
    reserve0: convertTokenToDecimal(event.params.reserve0, token0.decimals),
    reserve1: convertTokenToDecimal(event.params.reserve1, token1.decimals),
  };

  if (!pair.reserve1.eq(ZERO_BD)) {
    pair = {
      ...pair,
      token0Price: pair.reserve0.div(pair.reserve1),
    };
  } else {
    pair = {
      ...pair,
      token0Price: ZERO_BD,
    };
  }

  if (!pair.reserve0.eq(ZERO_BD)) {
    pair = {
      ...pair,
      token1Price: pair.reserve1.div(pair.reserve0),
    };
  } else {
    pair = {
      ...pair,
      token1Price: ZERO_BD,
    };
  }

  context.Pair.set(pair);

  // update ETH price now that reserves could have changed
  if (!bundle) return; // added from async

  // To get the ethPrice, we have to get the (dai, usdc and usdt)/WETH pairs
  bundle = {
    ...bundle,
    ethPrice: getEthPriceInUSD({
      daiPair: undefined, // Change this when we add dai/woas pair
      usdcPair: usdcPair,
      usdtPair: undefined, // Change this when we add more usdt liquidity
    }),
  };

  context.Bundle.set(bundle);

  let ethPerToken0 = await findEthPerToken(token0, factory, context);
  let ethPerToken1 = await findEthPerToken(token1, factory, context);

  token0 = {
    ...token0,
    derivedETH: ethPerToken0,
  };

  token1 = {
    ...token1,
    derivedETH: ethPerToken1,
  };

  context.Token.set(token0);
  context.Token.set(token1);

  // get tracked liquidity - will be 0 if neither is in whitelist
  let trackedLiquidityETH: BigDecimal;

  if (!bundle.ethPrice.eq(ZERO_BD)) {
    trackedLiquidityETH = getTrackedLiquidityUSD(
      pair.reserve0,
      token0,
      pair.reserve1,
      token1,
      bundle,
      context
    ).div(bundle.ethPrice);
  } else {
    trackedLiquidityETH = ZERO_BD;
  }

  const token0ReserveEth = pair.reserve0.times(token0.derivedETH);
  const token1ReserveEth = pair.reserve1.times(token1.derivedETH);
  const pairReserveEth = token0ReserveEth.plus(token1ReserveEth);

  // use derived amounts within pair
  pair = {
    ...pair,
    trackedReserveETH: trackedLiquidityETH,
    reserveETH: pairReserveEth,
  };

  // We can't combine this statement with the one above as we use the updated values
  pair = {
    ...pair,
    reserveUSD: pair.reserveETH.times(bundle.ethPrice),
  };

  // use tracked amounts globally
  factory = {
    ...factory,
    totalLiquidityETH: factory.totalLiquidityETH.plus(trackedLiquidityETH),
  };

  // We can't combine this statement with the one above as we use the updated values
  factory = {
    ...factory,
    totalLiquidityUSD: factory.totalLiquidityETH.times(bundle.ethPrice),
  };

  // now correctly set liquidity amounts for each token
  token0 = {
    ...token0,
    totalLiquidity: token0.totalLiquidity.plus(pair.reserve0),
  };

  token1 = {
    ...token1,
    totalLiquidity: token1.totalLiquidity.plus(pair.reserve1),
  };

  // save entities
  context.Pair.set(pair);
  context.Factory.set(factory);
  context.Token.set(token0);
  context.Token.set(token1);
});

TaffyPair.Mint.handler(async ({ event, context }) => {
  let [transaction, pair, factory, bundle] = await Promise.all([
    context.Transaction.get(event.transaction.hash),
    context.Pair.get(event.srcAddress),
    context.Factory.get(FACTORY_ADDRESS),
    context.Bundle.get("1"),
  ]);
  // Get All (mints[mints.length - 1])
  // context.Token.load(); // Get All => pair token0 and token1

  // Getting data for periodic updates (hour/day etc)
  let timestamp = event.block.timestamp;
  let dayID = Math.floor(timestamp / 86400);
  let dayPairID = event.srcAddress.concat("-").concat(dayID.toString());
  let hourIndex = Math.floor(timestamp / 3600); // get unique hour within unix history
  let hourPairID = event.srcAddress.concat("-").concat(hourIndex.toString());
  // let tokenDayID = token.id.toString().concat('-').concat(dayID.toString());

  // CANT DO THIS BECAUSE WE DONT HAVE THE TOKEN ID => WAITING FOR REVERSE LOOKUP
  // context.TokenDayData.load(tokenDayID, {}); // For updateTokenDayData

  // loaded from a previous handler creating this transaction
  // transfer event is emitted first and mint event is emitted afterwards, good to confirm with a protocol eng
  if (!transaction) return;

  let mints = transaction.mints;
  let mint = await context.Mint.get(mints[mints.length - 1]);

  if (!mint) return;

  if (!pair || !factory) return; // Added from async

  let token0 = await context.Token.get(pair.token0_id);
  let token1 = await context.Token.get(pair.token1_id);

  if (!token0 || !token1) return;

  // update exchange info (except balances, sync will cover that)
  let token0Amount = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  let token1Amount = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );

  // update txn counts
  token0 = {
    ...token0,
    txCount: token0.txCount + ONE_BI,
  };
  token1 = {
    ...token1,
    txCount: token1.txCount + ONE_BI,
  };

  // get new amounts of USD and ETH for tracking

  if (!bundle) return; // Added from async

  let amountTotalUSD = token1.derivedETH
    .times(token1Amount)
    .plus(token0.derivedETH.times(token0Amount))
    .times(bundle.ethPrice);

  // update txn counts
  pair = {
    ...pair,
    txCount: pair.txCount + ONE_BI,
  };
  factory = {
    ...factory,
    txCount: factory.txCount + ONE_BI,
  };

  // save entities
  context.Token.set(token0);
  context.Token.set(token1);
  context.Pair.set(pair);
  context.Factory.set(factory);

  mint = {
    ...mint,
    sender: event.params.sender,
    amount0: token0Amount,
    amount1: token1Amount,
    logIndex: event.logIndex,
    amountUSD: amountTotalUSD,
  };

  context.Mint.set(mint);

  // update day entities
  updatePairDayData(event, pair, context);
  updatePairHourData(event, pair, context);
  updateFactoryDayData(event, factory, context);
  updateTokenDayData(token0, event, bundle, context);
  updateTokenDayData(token1, event, bundle, context);
});

TaffyPair.Burn.handler(async ({ event, context }) => {
  let [transaction, pair, factory, bundle] = await Promise.all([
    context.Transaction.get(event.transaction.hash),
    context.Pair.get(event.srcAddress),
    context.Factory.get(FACTORY_ADDRESS),
    context.Bundle.get("1"),
  ]);

  if (!transaction || !pair || !factory) return;

  let burns = transaction.burns;

  let [burn, token0, token1] = await Promise.all([
    context.Burn.get(burns[burns.length - 1]),
    context.Token.get(pair.token0_id),
    context.Token.get(pair.token1_id),
  ]);

  // Get All (burns[burns.length - 1])
  // context.Token.load(); // Get All => pair token0 and token1

  // Getting data for periodic updates (hour/day etc)
  let timestamp = event.block.timestamp;
  let dayID = Math.floor(timestamp / 86400);
  let dayPairID = event.srcAddress.concat("-").concat(dayID.toString());
  let hourIndex = Math.floor(timestamp / 3600); // get unique hour within unix history
  let hourPairID = event.srcAddress.concat("-").concat(hourIndex.toString());
  // let tokenDayID = token.id.toString().concat('-').concat(dayID.toString());
  // CANT DO THIS BECAUSE WE DONT HAVE THE TOKEN ID => WAITING FOR REVERSE LOOKUP
  // context.TokenDayData.load(tokenDayID, {}); // For updateTokenDayData

  // safety check
  if (!transaction) return;

  if (!burn) return;

  if (!pair || !factory) return; // Added from async

  if (!token0 || !token1) return;

  let token0Amount = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  let token1Amount = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );

  // update txn counts
  token0 = {
    ...token0,
    txCount: token0.txCount + ONE_BI,
  };
  token1 = {
    ...token1,
    txCount: token1.txCount + ONE_BI,
  };

  // get new amounts of USD and ETH for tracking
  if (!bundle) return; // Added from async
  let amountTotalUSD = token1.derivedETH
    .times(token1Amount)
    .plus(token0.derivedETH.times(token0Amount))
    .times(bundle.ethPrice);

  factory = {
    ...factory,
    txCount: factory.txCount + ONE_BI,
  };

  // update txn counts
  pair = {
    ...pair,
    txCount: pair.txCount + ONE_BI,
  };

  // update global counter and save
  context.Token.set(token0);
  context.Token.set(token1);
  context.Pair.set(pair);
  context.Factory.set(factory);

  // update burn
  burn = {
    ...burn,
    amount0: token0Amount,
    amount1: token1Amount,
    logIndex: event.logIndex,
    amountUSD: amountTotalUSD,
    // burn.sender = event.params.sender
    // burn.to = event.params.to
  };

  context.Burn.set(burn);

  // update day entities
  updatePairDayData(event, pair, context);
  updatePairHourData(event, pair, context);
  updateFactoryDayData(event, factory, context);
  updateTokenDayData(token0, event, bundle, context);
  updateTokenDayData(token1, event, bundle, context);
});

TaffyPair.Swap.handler(async ({ event, context }) => {
  let [pair, bundle, factory, transaction] = await Promise.all([
    context.Pair.get(event.srcAddress),
    context.Bundle.get("1"),
    context.Factory.get(FACTORY_ADDRESS),
    context.Transaction.get(event.transaction.hash),
  ]);

  if (!pair) return;

  let [token0, token1] = await Promise.all([
    context.Token.get(pair.token0_id),
    context.Token.get(pair.token1_id),
  ]);

  // Getting data for periodic updates (hour/day etc)
  let timestamp = event.block.timestamp;
  let dayID = Math.floor(timestamp / 86400);
  let dayPairID = event.srcAddress.concat("-").concat(dayID.toString());
  let hourIndex = Math.floor(timestamp / 3600); // get unique hour within unix history
  let hourPairID = event.srcAddress.concat("-").concat(hourIndex.toString());
  // let tokenDayID = token.id.toString().concat('-').concat(dayID.toString());

  // CANT DO THIS BECAUSE WE DONT HAVE THE TOKEN ID => WAITING FOR REVERSE LOOKUP
  // context.TokenDayData.load(tokenDayID, {}); // For updateTokenDayData

  if (!pair) return; // Added from async

  if (!token0 || !token1) return;

  let amount0In = convertTokenToDecimal(
    event.params.amount0In,
    token0.decimals
  );
  let amount1In = convertTokenToDecimal(
    event.params.amount1In,
    token1.decimals
  );
  let amount0Out = convertTokenToDecimal(
    event.params.amount0Out,
    token0.decimals
  );
  let amount1Out = convertTokenToDecimal(
    event.params.amount1Out,
    token1.decimals
  );

  // totals for volume updates
  let amount0Total = amount0Out.plus(amount0In);
  let amount1Total = amount1Out.plus(amount1In);

  if (!bundle) return; // Added from async

  const token0DerivedEth = token0.derivedETH.times(amount0Total);
  const token1DerivedEth = token1.derivedETH.times(amount1Total);
  const summedDerivedEth = token0DerivedEth.plus(token1DerivedEth); // We'll have to divide this by 2

  // get total amounts of derived USD and ETH for tracking
  let derivedAmountETH = summedDerivedEth.div(BigDecimal("2"));

  let derivedAmountUSD = derivedAmountETH.times(bundle.ethPrice);

  // only accounts for volume through white listed tokens
  let trackedAmountUSD = getTrackedVolumeUSD(
    amount0Total,
    token0,
    amount1Total,
    token1,
    pair,
    bundle,
    context
  );

  let trackedAmountETH: BigDecimal;

  if (bundle.ethPrice.eq(ZERO_BD)) {
    trackedAmountETH = ZERO_BD;
  } else {
    trackedAmountETH = trackedAmountUSD.div(bundle.ethPrice);
  }

  // update token0 global volume and token liquidity stats and txn counts
  token0 = {
    ...token0,
    tradeVolume: token0.tradeVolume.plus(amount0In.plus(amount0Out)),
    tradeVolumeUSD: token0.tradeVolumeUSD.plus(trackedAmountUSD),
    untrackedVolumeUSD: token0.untrackedVolumeUSD.plus(derivedAmountUSD),
    txCount: token0.txCount + ONE_BI,
  };

  // update token1 global volume and token liquidity stats and txn counts
  token1 = {
    ...token1,
    tradeVolume: token1.tradeVolume.plus(amount1In.plus(amount1Out)),
    tradeVolumeUSD: token1.tradeVolumeUSD.plus(trackedAmountUSD),
    untrackedVolumeUSD: token1.untrackedVolumeUSD.plus(derivedAmountUSD),
    txCount: token1.txCount + ONE_BI,
  };

  pair = {
    ...pair,
    volumeUSD: pair.volumeUSD.plus(trackedAmountUSD),
    volumeToken0: pair.volumeToken0.plus(amount0Total),
    volumeToken1: pair.volumeToken1.plus(amount1Total),
    untrackedVolumeUSD: pair.untrackedVolumeUSD.plus(derivedAmountUSD),
    txCount: pair.txCount + ONE_BI,
  };

  context.Pair.set(pair);

  // update global values, only used tracked amounts for volume
  if (!factory) return; // Added from async

  factory = {
    ...factory,
    totalVolumeUSD: factory.totalVolumeUSD.plus(trackedAmountUSD),
    totalVolumeETH: factory.totalVolumeETH.plus(trackedAmountETH),
    untrackedVolumeUSD: factory.untrackedVolumeUSD.plus(derivedAmountUSD),
    txCount: factory.txCount + ONE_BI,
  };

  // save entities
  context.Pair.set(pair);
  context.Token.set(token0);
  context.Token.set(token1);
  context.Factory.set(factory);

  if (!transaction) {
    transaction = {
      id: event.transaction.hash,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      mints: [],
      swaps: [],
      burns: [],
    };
  }
  let swaps = transaction.swaps;
  let swap: Swap = {
    id: event.transaction.hash.concat("-").concat(swaps.length.toString()),
    transaction_id: transaction.id,
    pair_id: pair.id,
    timestamp: transaction.timestamp,
    sender: event.params.sender,
    amount0In: amount0In,
    amount1In: amount1In,
    amount0Out: amount0Out,
    amount1Out: amount1Out,
    to: event.params.to,
    from: event.transaction.from ?? event.params.sender,
    logIndex: event.logIndex,
    // use the tracked amount if we have it
    amountUSD: trackedAmountUSD.eq(ZERO_BD)
      ? derivedAmountUSD
      : trackedAmountUSD,
  };

  context.Swap.set(swap);

  // update the transaction

  // TODO: Consider using .concat() for handling array updates to protect
  // against unintended side effects for other code paths.
  swaps.push(swap.id);
  transaction = {
    ...transaction,
    swaps: swaps,
  };
  context.Transaction.set(transaction);

  // update day entities
  let pairDayData = await updatePairDayData(event, pair, context);
  let pairHourData = await updatePairHourData(event, pair, context);
  let factoryDayData = await updateFactoryDayData(event, factory, context);
  let token0DayData = await updateTokenDayData(token0, event, bundle, context);
  let token1DayData = await updateTokenDayData(token1, event, bundle, context);

  // swap specific updating
  factoryDayData = {
    ...factoryDayData,
    dailyVolumeUSD: factoryDayData.dailyVolumeUSD.plus(trackedAmountUSD),
    dailyVolumeETH: factoryDayData.dailyVolumeETH.plus(trackedAmountETH),
    dailyVolumeUntracked:
      factoryDayData.dailyVolumeUntracked.plus(derivedAmountUSD),
  };
  context.FactoryDayData.set(factoryDayData);

  // swap specific updating for pair
  pairDayData = {
    ...pairDayData,
    dailyVolumeToken0: pairDayData.dailyVolumeToken0.plus(amount0Total),
    dailyVolumeToken1: pairDayData.dailyVolumeToken1.plus(amount1Total),
    dailyVolumeUSD: pairDayData.dailyVolumeUSD.plus(trackedAmountUSD),
  };

  context.PairDayData.set(pairDayData);

  // update hourly pair data
  pairHourData = {
    ...pairHourData,
    hourlyVolumeToken0: pairHourData.hourlyVolumeToken0.plus(amount0Total),
    hourlyVolumeToken1: pairHourData.hourlyVolumeToken1.plus(amount1Total),
    hourlyVolumeUSD: pairHourData.hourlyVolumeUSD.plus(trackedAmountUSD),
  };

  context.PairHourData.set(pairHourData);

  // swap specific updating for token0
  token0DayData = {
    ...token0DayData,
    dailyVolumeToken: token0DayData.dailyVolumeToken.plus(amount0Total),
    dailyVolumeETH: token0DayData.dailyVolumeETH.plus(
      amount0Total.times(token0.derivedETH)
    ),
    dailyVolumeUSD: token0DayData.dailyVolumeUSD.plus(
      amount0Total.times(token0.derivedETH).times(bundle.ethPrice)
    ),
  };

  context.TokenDayData.set(token0DayData);

  // swap specific updating
  token1DayData = {
    ...token1DayData,
    dailyVolumeToken: token1DayData.dailyVolumeToken.plus(amount1Total),
    dailyVolumeETH: token1DayData.dailyVolumeETH.plus(
      amount1Total.times(token1.derivedETH)
    ),
    dailyVolumeUSD: token1DayData.dailyVolumeUSD.plus(
      amount1Total.times(token1.derivedETH).times(bundle.ethPrice)
    ),
  };

  context.TokenDayData.set(token1DayData);
});
