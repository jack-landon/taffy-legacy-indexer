import assert from "assert";
import {
  TestHelpers,
} from "generated";
const { MockDb, TaffyFactory } = TestHelpers;

describe("TaffyFactory contract PairCreated event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for TaffyFactory contract PairCreated event
  const event = TaffyFactory.PairCreated.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */ });

  it("TaffyFactory_PairCreated is created correctly", async () => {

  });
});
