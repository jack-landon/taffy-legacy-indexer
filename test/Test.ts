import assert from "assert";
import { 
  TestHelpers,
  TaffyFactory_PairCreated
} from "generated";
const { MockDb, TaffyFactory } = TestHelpers;

describe("TaffyFactory contract PairCreated event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for TaffyFactory contract PairCreated event
  const event = TaffyFactory.PairCreated.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("TaffyFactory_PairCreated is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await TaffyFactory.PairCreated.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualTaffyFactoryPairCreated = mockDbUpdated.entities.TaffyFactory_PairCreated.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedTaffyFactoryPairCreated: TaffyFactory_PairCreated = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      token0: event.params.token0,
      token1: event.params.token1,
      pair: event.params.pair,
      _3: event.params._3,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualTaffyFactoryPairCreated, expectedTaffyFactoryPairCreated, "Actual TaffyFactoryPairCreated should be the same as the expectedTaffyFactoryPairCreated");
  });
});
