import { describe, test, expect } from "vitest"
import { Table } from "./Table"

describe("Table", () => {
  test("basic", () => {
    expect(() => Table([1, 2])).not.toThrow()
  })
})
