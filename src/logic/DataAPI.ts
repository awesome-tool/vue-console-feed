// "warn" | "info" | "debug" | "error" | "output" | "log"
// "table"
// "group" | "groupEnd"

import { sprintf } from "sprintf-js"
import { readonly, reactive } from "vue"

import { Encode } from "./Encode"
import { isTable, Table } from "./Table"
import { get } from "./id-manager"

interface LogData {
  readonly data: readonly ReturnType<typeof Encode>[]
  count: number
  readonly type: "warn" | "info" | "debug" | "error" | "output" | "log"
}
interface TableData {
  readonly data: ReturnType<typeof Table>
  readonly type: "table"
}

export interface GroupData {
  readonly "@key": ReturnType<typeof Encode>
  readonly "@items": (LogData | TableData | GroupData)[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isGroup(data: any): data is GroupData {
  return typeof data?.["@items"]?.length === "number"
}

export function printfArgs<T extends unknown[]>(args: T) {
  if (args.length > 0 && typeof args[0] === "string") {
    const countParaments = args[0].match(/%\w/g)?.length

    if (countParaments) {
      const { length } = args
      return [
        sprintf(
          args[0],
          ...args.slice(1, countParaments + 1),
          ...(length - 1 < countParaments
            ? Array(countParaments - (length - 1)).fill("%s")
            : [])
        ),
        ...args.slice(countParaments + 1)
      ]
    }
  }

  return args
}

export class DataAPI<
  Encoded extends boolean = false,
  Data extends Encoded extends true
  ? ReturnType<typeof Encode>
  : unknown = Encoded extends true ? ReturnType<typeof Encode> : unknown
> {
  public readonly value: (LogData | TableData | GroupData)[] = reactive(
    []
  )

  private readonly queueGroups: GroupData[] = []

  private readonly counters = new Map<string, number>()
  private readonly timers = new Map<string, number>()

  private readonly encoded?: Encoded
  private readonly asc?: boolean = false

  constructor(encoded?: Encoded, private deepLocation = 0, asc = false) {
    this.encoded = encoded
    this.asc = asc
  }

  private basicMethod(
    type: "warn" | "info" | "debug" | "error" | "log",
    data: Data[]
  ): void {
    // これ
    const dataEncoded = (
      this.encoded
        ? data
        : printfArgs(data).map((item) => Encode(item, this.deepLocation + 3))
    ) as readonly ReturnType<typeof Encode>[]
    // eslint-disable-next-line functional/no-let
    let lastItem: typeof this.value[0]
    if (this.queueGroups.length > 0) {
      const lastGroup = this.queueGroups[this.queueGroups.length - 1]
      lastItem = lastGroup["@items"][lastGroup["@items"].length - 1]
    } else {
      lastItem = this.value[this.value.length - 1]
    }

    if (
      lastItem &&
      !isGroup(lastItem) &&
      lastItem.type === type &&
      lastItem.data.length === dataEncoded.length &&
      lastItem.data.every(
        (item, index) => item["@id"] === dataEncoded[index]["@id"]
      )
    ) {
      lastItem.count++
      return
    }

    this.insertData({
      type,
      data: readonly(dataEncoded) as typeof dataEncoded,
      count: 1
    })
  }

  // eslint-disable-next-line functional/functional-parameters
  public log(...data: Data[]): void {
    this.basicMethod("log", data)
  }

  // eslint-disable-next-line functional/functional-parameters
  public warn(...data: Data[]): void {
    this.basicMethod("warn", data)
  }

  // eslint-disable-next-line functional/functional-parameters
  public info(...data: Data[]): void {
    this.basicMethod("info", data)
  }

  // eslint-disable-next-line functional/functional-parameters
  public debug(...data: Data[]): void {
    this.basicMethod("debug", data)
  }

  // eslint-disable-next-line functional/functional-parameters
  public error(...data: Data[]): void {
    this.basicMethod("error", data)
  }

  public table(
    data: Encoded extends true
      ? ReturnType<typeof Table> | ReturnType<typeof Encode>
      : unknown
  ): void {
    if (this.encoded) {
      /// encode
      if (isTable(data)) {
        this.insertData({
          type: "table",
          data: readonly(data) as typeof data
        })
        return
      }

      this.log(data as Data)
      return
    }

    if (typeof data === "object") {
      this.insertData({
        type: "table",
        data: readonly(
          Table(data as unknown as object, this.deepLocation + 2)
        ) as ReturnType<typeof Table>
      })

      return
    }

    this.log(data as unknown as Data)
  }

  private insertData(data: LogData | TableData | GroupData): void {
    const method = this.asc ? "unshift" : "push"
    if (this.queueGroups.length > 0) {
      const currentGroup = this.queueGroups[this.queueGroups.length - 1]

      // exists
      currentGroup["@items"][method](data)
      return
    }

    this.value[method](data)
  }

  public group(
    key: Data = (this.encoded
      ? Encode("console.group", this.deepLocation + 2)
      : "console.group") as Data
  ): void {
    const newGroup: GroupData = {
      "@key": readonly(
        this.encoded
          ? (key as ReturnType<typeof Encode>)
          : Encode(key, this.deepLocation + 2)
      ) as ReturnType<typeof Encode>,
      "@items": reactive([])
    }

    this.insertData(newGroup)
    this.queueGroups.push(newGroup)
  }

  public groupEnd(
    key: Data = (this.encoded
      ? Encode("console.group", this.deepLocation + 2)
      : "console.group") as Data
  ): void {
    const idKey = this.encoded
      ? (key as ReturnType<typeof Encode>)["@id"]
      : get(key)
    // eslint-disable-next-line functional/no-let
    for (let i = this.queueGroups.length - 1; i >= 0; i--) {
      if (this.queueGroups[i]["@key"]["@id"] === idKey) {
        // end task
        this.queueGroups.splice(i)
        break
      }
    }
  }

  public count(key: unknown = "default"): void {
    // eslint-disable-next-line functional/no-let
    let count: number | undefined
    if ((count = this.counters.get(key + ""))) {
      count++
    } else {
      count = 1
    }

    this.counters.set(key + "", count)
    const message = `${key}: ${count}`
    this.log(
      (this.encoded ? Encode(message, this.deepLocation + 2) : message) as Data
    )
  }

  public countReset(key: unknown = "default"): void {
    this.counters.delete(key + "")
  }

  public time(key: unknown = "default"): void {
    if (this.timers.has(key + "")) {
      const message = `Timer '${key}' already exists`
      this.warn(
        (this.encoded
          ? Encode(message, this.deepLocation + 2)
          : message) as Data
      )
      return
    }

    this.timers.set(key + "", performance.now())
  }

  public timeLog(key: unknown = "default"): void {
    const timer = this.timers.get(key + "")
    if (!timer) {
      const message = `Timer '${key}' does not exist`
      this.warn(
        (this.encoded
          ? Encode(message, this.deepLocation + 2)
          : message) as Data
      )
      return
    }

    const message = `${key}: ${performance.now() - timer} ms`
    this.log(
      (this.encoded ? Encode(message, this.deepLocation + 2) : message) as Data
    )
  }

  public timeEnd(key: unknown = "default"): void {
    this.timeLog(key)
    this.timers.delete(key + "")
  }

  public clear(): void {
    this.value.splice(0)
    this.queueGroups.splice(0)
    this.counters.clear()
    this.timers.clear()
  }
}
