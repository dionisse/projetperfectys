import { describe, expect, it } from "vitest";
import { InMemorySyncOutbox, type PendingOperation } from "../src/index";

describe("outbox de synchronisation (portage de SqliteOutboxTests.cs)", () => {
  it("est idempotente à l'enfilement et libère l'opération acquittée", async () => {
    const outbox = new InMemorySyncOutbox();
    const operation: PendingOperation = {
      id: "op-1",
      organizationId: "org-1",
      operationType: "accounting.entry.created",
      payload: "{}",
      createdAt: new Date().toISOString(),
      attemptCount: 0
    };

    await outbox.enqueue(operation);
    await outbox.enqueue(operation);

    const pending = await outbox.getPending();
    expect(pending).toHaveLength(1);

    await outbox.markCompleted(operation.id);
    expect(await outbox.getPending()).toHaveLength(0);
  });
});
