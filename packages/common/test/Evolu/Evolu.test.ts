import { describe, expect, expectTypeOf, test, vi } from "vitest";
import { createConsole } from "../../src/Console.js";
import { createEvolu } from "../../src/Evolu/Evolu.js";
import { getOrThrow } from "../../src/Result.js";
import { SqliteBoolean } from "../../src/Sqlite.js";
import {
  Boolean,
  id,
  InferType,
  maxLength,
  NonEmptyString,
  nullOr,
  SimpleName,
} from "../../src/Type.js";
import {
  testCreateId,
  testNanoIdLib,
  testSimpleName,
  testTime,
} from "../_deps.js";
import {
  ValidateColumnTypes,
  ValidateIdColumnType,
  ValidateNoDefaultColumns,
  ValidateSchemaHasId,
} from "../../src/Evolu/Schema.js";

const TodoId = id("Todo");
type TodoId = InferType<typeof TodoId>;

const TodoCategoryId = id("TodoCategory");
type TodoCategoryId = InferType<typeof TodoCategoryId>;

const NonEmptyString50 = maxLength(50)(NonEmptyString);
type NonEmptyString50 = InferType<typeof NonEmptyString50>;

const Schema = {
  todo: {
    id: TodoId,
    title: NonEmptyString50,
    isCompleted: nullOr(SqliteBoolean),
    categoryId: nullOr(TodoCategoryId),
  },
  todoCategory: {
    id: TodoCategoryId,
    name: NonEmptyString50,
  },
};

const mockDeps = () => {
  const dbWorker = {
    onMessage: vi.fn(),
    postMessage: vi.fn(),
  };

  return {
    createDbWorker: () => dbWorker,
    time: testTime,
    nanoIdLib: testNanoIdLib,
    console: createConsole(),
    createAppState: () => ({
      reset: vi.fn(),
    }),
  };
};

let instancesCount = 0;

const setupEvoluTest = () => {
  const deps = mockDeps();
  const evolu = createEvolu(deps)(Schema, {
    name: getOrThrow(SimpleName.from(`instance${instancesCount++}`)),
  });
  const dbWorker = deps.createDbWorker();

  return { deps, evolu, dbWorker };
};

test("init postMessage call", () => {
  const { dbWorker } = setupEvoluTest();

  expect(dbWorker.postMessage.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          "config": {
            "enableLogging": false,
            "maxDrift": 300000,
            "name": "instance0",
            "reloadUrl": "/",
            "syncUrl": "wss://free.evoluhq.com",
          },
          "dbSchema": {
            "indexes": [],
            "tables": [
              {
                "columns": [
                  "title",
                  "isCompleted",
                  "categoryId",
                ],
                "name": "todo",
              },
              {
                "columns": [
                  "name",
                ],
                "name": "todoCategory",
              },
            ],
          },
          "initialData": [],
          "type": "init",
        },
      ],
    ]
  `);
});

test("insert should validate input and call postMessage", async () => {
  const { evolu, dbWorker } = setupEvoluTest();

  const validTodo = {
    title: "Test Todo",
  };

  const result = evolu.insert("todo", validTodo);

  expect(result.ok).toBe(true);
  expect(result.ok && result.value.id).toMatchInlineSnapshot(
    `"3C22DRVU0AHGjXpOEP-WJ"`,
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(dbWorker.postMessage.mock.calls[1]).toMatchInlineSnapshot(`
    [
      {
        "changes": [
          {
            "id": "3C22DRVU0AHGjXpOEP-WJ",
            "table": "todo",
            "values": {
              "title": "Test Todo",
            },
          },
        ],
        "onCompleteIds": [],
        "subscribedQueries": [],
        "tabId": "kYF3FmbitSesTwHwplqLB",
        "type": "mutate",
      },
    ]
  `);
});

test("insert should reject invalid input", () => {
  const { evolu } = setupEvoluTest();

  // Empty title (violates NonEmptyString constraint)
  const invalidTodo = {
    title: "",
  };

  const result = evolu.insert("todo", invalidTodo);

  expect(result).toMatchInlineSnapshot(`
    {
      "error": {
        "reason": {
          "errors": {
            "title": {
              "min": 1,
              "type": "MinLength",
              "value": "",
            },
          },
          "kind": "Props",
        },
        "type": "Object",
        "value": {
          "title": "",
        },
      },
      "ok": false,
    }
  `);
});

test("update should validate input and call postMessage", async () => {
  const { evolu, dbWorker } = setupEvoluTest();

  const testId = testCreateId();

  // Valid update
  const validUpdate = {
    id: testId,
    title: "Updated Todo",
  };

  const result = evolu.update("todo", validUpdate);

  expect(result.ok).toBe(true);
  expect(result.ok && result.value.id).toBe(testId);

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(dbWorker.postMessage.mock.calls[1]).toMatchInlineSnapshot(`
    [
      {
        "changes": [
          {
            "id": "D2PtSrFu-SJV0Ui1_SJB3",
            "table": "todo",
            "values": {
              "title": "Updated Todo",
            },
          },
        ],
        "onCompleteIds": [],
        "subscribedQueries": [],
        "tabId": "kYF3FmbitSesTwHwplqLB",
        "type": "mutate",
      },
    ]
  `);
});

test("update should reject invalid input", () => {
  const { evolu } = setupEvoluTest();

  // Missing id
  const invalidUpdate = {
    title: "Updated Todo",
  };

  // @ts-expect-error - Testing runtime validation
  const result = evolu.update("todo", invalidUpdate);

  // Should return error
  expect(result).toMatchInlineSnapshot(`
    {
      "error": {
        "reason": {
          "errors": {
            "id": {
              "type": "String",
              "value": undefined,
            },
          },
          "kind": "Props",
        },
        "type": "Object",
        "value": {
          "title": "Updated Todo",
        },
      },
      "ok": false,
    }
  `);
});

test("upsert should validate input and call postMessage", async () => {
  const { evolu, dbWorker } = setupEvoluTest();

  const testId = testCreateId();

  // Valid upsert
  const validUpsert = {
    id: testId,
    title: "Upserted Todo",
  };

  const result = evolu.upsert("todo", validUpsert);

  expect(result.ok).toBe(true);
  expect(result.ok && result.value.id).toBe(testId);

  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(dbWorker.postMessage.mock.calls[1]).toMatchInlineSnapshot(`
    [
      {
        "changes": [
          {
            "id": "v5rPltodHge37rn9q4lwi",
            "table": "todo",
            "values": {
              "title": "Upserted Todo",
            },
          },
        ],
        "onCompleteIds": [],
        "subscribedQueries": [],
        "tabId": "kYF3FmbitSesTwHwplqLB",
        "type": "mutate",
      },
    ]
  `);
});

test("upsert should reject invalid input", () => {
  const { evolu } = setupEvoluTest();

  const testId = testCreateId();

  const invalidUpsert = {
    id: testId,
    title: "",
  };

  const result = evolu.upsert("todo", invalidUpsert);

  expect(result).toMatchInlineSnapshot(`
    {
      "error": {
        "reason": {
          "errors": {
            "title": {
              "min": 1,
              "type": "MinLength",
              "value": "",
            },
          },
          "kind": "Props",
        },
        "type": "Object",
        "value": {
          "id": "6xwHpK2ZkuZUN-T4MZhx0",
          "title": "",
        },
      },
      "ok": false,
    }
  `);
});

test("mutations should be processed in microtask queue", async () => {
  const { evolu, dbWorker } = setupEvoluTest();

  // Queue multiple mutations
  evolu.insert("todo", { title: "Todo 1" });
  evolu.insert("todo", { title: "Todo 2" });
  evolu.insert("todo", { title: "Todo 3" });

  await new Promise((resolve) => setTimeout(resolve, 0));

  // Only one postMessage call should happen with all changes
  expect(dbWorker.postMessage).toHaveBeenCalledTimes(2); // 1 for init, 1 for mutations
  expect(dbWorker.postMessage.mock.calls[1]).toMatchInlineSnapshot(`
    [
      {
        "changes": [
          {
            "id": "yVRcpEppKHyKrUtl5RZ4m",
            "table": "todo",
            "values": {
              "title": "Todo 1",
            },
          },
          {
            "id": "CTxiAw0gY_fIT5Ci6Vt_f",
            "table": "todo",
            "values": {
              "title": "Todo 2",
            },
          },
          {
            "id": "kbP-KUG7NKoSfTGGJoCBJ",
            "table": "todo",
            "values": {
              "title": "Todo 3",
            },
          },
        ],
        "onCompleteIds": [],
        "subscribedQueries": [],
        "tabId": "kYF3FmbitSesTwHwplqLB",
        "type": "mutate",
      },
    ]
  `);
});

test("mutation with onlyValidate should not call postMessage", async () => {
  const { evolu, dbWorker } = setupEvoluTest();

  evolu.insert("todo", { title: "Validation only" }, { onlyValidate: true });

  await new Promise((resolve) => setTimeout(resolve, 0));

  // Only init should be called, not the mutation
  expect(dbWorker.postMessage).toHaveBeenCalledTimes(1);
});

test("mutations should fail as a transaction when any mutation fails", async () => {
  const { evolu, dbWorker } = setupEvoluTest();

  // Queue valid and invalid mutations
  evolu.insert("todo", { title: "Valid Todo" });
  evolu.insert("todo", { title: "" }); // Invalid - empty title
  evolu.insert("todo", { title: "Another Valid Todo" });

  await new Promise((resolve) => setTimeout(resolve, 0));

  // Only init should be called, not the mutations since one failed
  expect(dbWorker.postMessage).toHaveBeenCalledTimes(1);
});

describe("EvoluSchema validation", () => {
  test("schema without id column", () => {
    const deps = mockDeps();

    const SchemaWithoutId = {
      todo: {
        // Missing id column - should cause TypeScript error
        title: NonEmptyString50,
      },
    };

    // Type-level assertion for the exact error message
    type ValidationResult = ValidateSchemaHasId<typeof SchemaWithoutId>;
    expectTypeOf<ValidationResult>().toEqualTypeOf<'❌ Schema Error: Table "todo" is missing required id column.'>();

    // @ts-expect-error - Schema validation should catch missing id column
    createEvolu(deps)(SchemaWithoutId, {
      name: testSimpleName,
    });
  });

  test("schema with default column createdAt", () => {
    const deps = mockDeps();

    const SchemaWithDefaultColumn = {
      todo: {
        id: TodoId,
        createdAt: NonEmptyString50,
      },
    };

    // Type-level assertion for the exact error message
    type ValidationResult = ValidateNoDefaultColumns<
      typeof SchemaWithDefaultColumn
    >;
    expectTypeOf<ValidationResult>().toEqualTypeOf<'❌ Schema Error: Table "todo" uses default column name "createdAt". Default columns (createdAt, updatedAt, isDeleted) are added automatically.'>();

    // @ts-expect-error - Schema validation should catch default column name
    createEvolu(deps)(SchemaWithDefaultColumn, {
      name: testSimpleName,
    });
  });

  test("schema with default column updatedAt", () => {
    const deps = mockDeps();

    const SchemaWithDefaultColumn = {
      todo: {
        id: TodoId,
        updatedAt: NonEmptyString50,
      },
    };

    // Type-level assertion for the exact error message
    type ValidationResult = ValidateNoDefaultColumns<
      typeof SchemaWithDefaultColumn
    >;
    expectTypeOf<ValidationResult>().toEqualTypeOf<'❌ Schema Error: Table "todo" uses default column name "updatedAt". Default columns (createdAt, updatedAt, isDeleted) are added automatically.'>();

    // @ts-expect-error - Schema validation should catch default column name
    createEvolu(deps)(SchemaWithDefaultColumn, {
      name: testSimpleName,
    });
  });

  test("schema with default column isDeleted", () => {
    const deps = mockDeps();

    const SchemaWithDefaultColumn = {
      todo: {
        id: TodoId,
        isDeleted: NonEmptyString50,
      },
    };

    // Type-level assertion for the exact error message
    type ValidationResult = ValidateNoDefaultColumns<
      typeof SchemaWithDefaultColumn
    >;
    expectTypeOf<ValidationResult>().toEqualTypeOf<'❌ Schema Error: Table "todo" uses default column name "isDeleted". Default columns (createdAt, updatedAt, isDeleted) are added automatically.'>();

    // @ts-expect-error - Schema validation should catch default column name
    createEvolu(deps)(SchemaWithDefaultColumn, {
      name: testSimpleName,
    });
  });

  test("schema with non-branded id column", () => {
    const deps = mockDeps();

    const SchemaWithInvalidId = {
      todo: {
        id: NonEmptyString50,
        title: NonEmptyString50,
      },
    };

    // Type-level assertion for the exact error message
    type ValidationResult = ValidateIdColumnType<typeof SchemaWithInvalidId>;
    expectTypeOf<ValidationResult>().toEqualTypeOf<'❌ Schema Error: Table "todo" id column must be a branded ID type (created with id("todo")).'>();

    // @ts-expect-error - Schema validation should catch non-branded id column
    createEvolu(deps)(SchemaWithInvalidId, {
      name: testSimpleName,
    });
  });

  test("schema with incompatible column type", () => {
    const deps = mockDeps();

    const SchemaWithInvalidType = {
      todo: {
        id: TodoId,
        title: NonEmptyString50,
        invalidColumn: Boolean, // Boolean is not compatible with SQLite
      },
    };

    // Type-level assertion for the exact error message
    type ValidationResult = ValidateColumnTypes<typeof SchemaWithInvalidType>;
    expectTypeOf<ValidationResult>().toEqualTypeOf<'❌ Schema Error: Table "todo" column "invalidColumn" type is not compatible with SQLite. Column types must extend SqliteValue (string, number, Uint8Array, or null).'>();

    // @ts-expect-error - Schema validation should catch incompatible column type
    createEvolu(deps)(SchemaWithInvalidType, {
      name: testSimpleName,
    });
  });
});
