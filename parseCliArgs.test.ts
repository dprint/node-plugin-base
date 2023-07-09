import { parseCliArgs } from "./parseCliArgs.ts";
import { assertEquals, assertThrows } from "$std/testing/asserts.ts";

Deno.test("should parse with --init", () => {
  assertEquals(parseCliArgs(["--parent-pid", "123", "--init"]), {
    isInit: true,
    parentProcessId: 123,
  });
});

Deno.test("should parse no --init", () => {
  assertEquals(parseCliArgs(["--parent-pid", "123"]), {
    isInit: false,
    parentProcessId: 123,
  });
});

Deno.test("should error no parent pid", () => {
  assertThrows(
    () => parseCliArgs(["--init"]),
    Error,
    "Please provide a --parent-pid <pid> flag.",
  );
});
