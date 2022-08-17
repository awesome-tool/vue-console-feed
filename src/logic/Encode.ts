/* eslint-disable @typescript-eslint/ban-types */
import { entries } from "./entries"
import { isList } from "./isList"
import { isDom } from "./isDom"
import { shouldInline } from "./shouldInline"
import { isCollection } from "./isCollection"
import { getOwnDescriptorsIn } from "./getOwnDescriptorsIn"
import { getOwnDescriptorsRegExp } from "./getOwnDescriptorsRegExp"
import { getValue } from "./getValue"
import { isPromise } from "./isPromise"
import { isTypedArray } from "./isTypedArray"
import { isBuffer } from "./isBuffer"
import { getOwnDescriptorsTypedArray } from "./getOwnDescriptorsTypedArray"
import { getObjectName } from "./getObjectName"
import { createRealItem } from "./createRealItem"

interface RealItem<T> {
  "@hidden": boolean
  "@value": T
}
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Data {
  export interface String {
    "@t": "string"
    "@value": string
  }
  export interface Number {
    "@t": "number"
    "@value": string
  }
  export interface BigInt {
    "@t": "bint"
    "@value": string
  }
  export interface Symbol {
    "@t": "symbol"
    "@value": string
  }
  export interface Nill {
    "@t": "nill"
    "@value": "null" | "undefined"
  }
  export interface Function {
    "@t": "function"
    "@name": string
    "@first": boolean
    "@code": string
    "@real": objReal | Link
  }
  //=============
  export interface Collection extends Omit<Record, "@t" | "@de" | "@first"> {
    "@t": "collection"
    "@name": "map" | "weakmap" | "set" | "weakset"
    "@size": number | null
    "@entries": unknown
  }
  //==============
  export interface RegExp extends Omit<Record, "@t" | "@de"> {
    "@t": "regexp"
    "@flags": string
    "@source": string
  }
  export interface GetSetter {
    "@t": "gs"
    "@value": Link
    "@at": Partial<{
      [name in "get" | "set"]: Function
    }>
  }
  export interface objReal {
    [name: string]: RealItem<
      | GetSetter
      | String
      | Number
      | BigInt
      | Symbol
      | Function
      | Collection
      | RegExp
      | Record
      | Nill
      // | Link
      | Error
      | Array
      | Element
      | Promise
      | Date
      | TypedArray
      | Buffer
    >
  }
  export interface Link {
    "@t": "link"
    "@type": "object" | "function"
    "@link": string
    "@name": string | null
  }
  export interface Record {
    "@t": "object"
    "@name": string | null
    "@first": boolean
    "@real": objReal | Link
    "@des"?: {
      "@value": DataPreview.objReal
      "@lastKey": string
    } | null
  }
  export interface Error {
    "@t": "error"
    "@first": boolean
    "@stack": string // use
    "@real": objReal // use
  }
  export interface Array {
    "@t": "array"
    "@size": number
    "@name"?: string
    "@first": boolean
    "@real": objReal & {
      // TODO:いみわかない！
      length: RealItem<Number>
    }
  }
  export interface Element {
    "@t": "element"
    "@name": string
    "@first": boolean
    "@attrs"?: [string, string][]
    "@real"?: Link
    "@childs"?: string | null | Link
  }
  export interface Promise {
    "@t": "promise"
    "@first": boolean
    "@state": "pending" | "fulfilled" | "rejected"
    "@real": objReal
  }
  export interface Date {
    "@t": "date"
    "@first": boolean
    "@value": string
    "@real": objReal
  }
  export interface TypedArray extends Omit<Array, "@t"> {
    "@t": "typedarray"
    "@real": Array["@real"] & {
      buffer: RealItem<Buffer>
      byteLength: RealItem<Number>
      byteOffset: RealItem<Number>
      [Symbol.toStringTag]: RealItem<String>
    }
  }
  export interface Buffer extends Omit<Array, "@t" | "@real"> {
    "@t": "buffer"
    // size is equal byteLength
    "@real": objReal & {
      byteLength: RealItem<Number>
      "[[Int8Array]]": RealItem<TypedArray>
      "[[Uint8Array]]": RealItem<TypedArray>

      "[[Int16Array]]": RealItem<TypedArray>
      "[[Int32Array]]": RealItem<TypedArray>

      "[[ArrayBufferByteLength]]": RealItem<Number>
      /*
[[Int8Array]]: Int8Array(4)
[[Uint8Array]]: Uint8Array(4)
[[Int16Array]]: Int16Array(2)
[[Int32Array]]: Int32Array(1)

[[ArrayBufferByteLength]]: 4
[[ArrayBufferData]]: 8349
      */
    }
  }
}

const nameByNodeType = {
  1: "ELEMENT_NODE",
  3: "TEXT_NODE",
  7: "PROCESSING_INSTRUCTION_NODE",
  8: "COMMENT_NODE",
  9: "DOCUMENT_NODE",
  10: "DOCUMENT_TYPE_NODE", // http://stackoverflow.com/questions/6088972/get-doctype-of-an-html-as-string-with-javascript
  11: "DOCUMENT_FRAGMENT_NODE"
}

// ============= link object ==============
const linkStore = new Map<string, object>()
function createLinkObject(obj: object): Data.Link {
  const name =
    typeof obj === "function" ? obj.name : obj?.constructor?.name ?? null

  for (const [link, tObj] of linkStore) {
    if (tObj === obj) {
      return {
        "@t": "link",
        "@type": typeof obj as "object" | "function",
        "@link": link,
        "@name": name
        // '@link':
      }
    }
  }

  const uid = Math.random().toString(34)

  linkStore.set(uid, obj)

  return {
    "@t": "link",
    "@type": typeof obj as "object" | "function",
    "@link": uid,
    "@name": name
  }
}
export function readLinkObject(link: Data.Link) {
  const obj = linkStore.get(link["@link"])

  console.log("readLink: ", { obj })

  return Encode(obj, false, false)
}
export function callFnLink(
  link: Data.Link
): ReturnType<typeof Encode> | Data.Error {
  const fn = linkStore.get(link["@link"])

  if (typeof fn !== "function")
    return {
      "@t": "error",
      "@first": false,
      "@stack": "Error: this memory freed.",
      "@real": {}
    }

  return Encode(fn(), false, true)
}
export function _getListLink(
  link: Data.Link
): (ReturnType<typeof Encode> | Data.Error)[] {
  const obj = linkStore.get(link["@link"])

  if (obj === undefined || !("length" in obj))
    return [
      {
        "@t": "error",
        "@first": false,
        "@stack": "Error: this memory freed.",
        "@real": {}
      }
    ]

  return Array.from(obj as ArrayLike<Node>).map((item) =>
    Encode(item, true, true)
  )
}
export function clearLinkStore() {
  linkStore.clear()
}
// ==========================================
export function Encode(
  data: unknown,
  first: boolean, // false,
  linkReal: boolean // false
):
  | Data.String
  | Data.Number
  | Data.BigInt
  | Data.Symbol
  | Data.Function
  | Data.Collection
  | Data.RegExp
  | Data.Nill
  | Data.Record
  | Data.Error
  | Data.Array
  | Data.Element
  | Data.Promise
  | Data.Date
  | Data.TypedArray
  | Data.Buffer {
  if (data instanceof Error) {
    const meta: Data.Error = {
      "@t": "error",
      "@first": first,
      "@stack": data.stack ?? "",
      "@real": encodeObject(data)
    }
    return meta
  }

  switch (typeof data) {
    case "string": {
      const meta: Data.String = {
        "@t": "string",
        "@value": data
      }
      return meta
    }
    case "number":
    case "boolean": {
      const meta: Data.Number = {
        "@t": "number",
        "@value": data.toString()
      }
      return meta
    }
    case "bigint": {
      const meta: Data.BigInt = {
        "@t": "bint",
        "@value": data.toString() + "n"
      }
      return meta
    }
    case "symbol": {
      const meta: Data.Symbol = {
        "@t": "symbol",
        "@value": data.toString()
      }
      return meta
    }
    case "undefined": {
      const meta: Data.Nill = {
        "@t": "nill",
        "@value": "undefined"
      }
      return meta
    }
    case "function": {
      const code = data + ""
      const name = code.slice(
        code.startsWith("function") ? 8 : 0,
        code.indexOf("{") >>> 0
      )
      const meta: Data.Function = {
        "@t": "function",
        "@code": first ? data.toString() : "",
        "@name": name,
        "@first": first,
        "@real": linkReal ? createLinkObject(data) : encodeObject(data)
      }
      return meta
    }
    case "object": {
      if (data === null) {
        const meta: Data.Nill = {
          "@t": "nill",
          "@value": "null"
        }
        return meta
      }

      if (data instanceof RegExp) {
        const meta: Data.RegExp = {
          "@t": "regexp",
          "@name": data + "",
          "@first": first,
          "@flags": data.flags,
          "@source": data.source,
          // わかない。ぜんぜんわかない！
          "@real": encodeObject(data, getOwnDescriptorsRegExp(data))
        }
        return meta
      }

      if (data instanceof Date) {
        const meta: Data.Date = {
          "@t": "date",
          "@first": first,
          "@value": data.toString(),
          "@real": encodeObject(data)
        }

        return meta
      }

      if (isList(data)) {
        const meta: Data.Array = {
          "@t": "array",
          "@size": data.length,
          "@name": data instanceof NodeList ? "NodeList" : undefined,
          "@first": first,
          "@real": encodeObject(data) as ReturnType<typeof encodeObject> & {
            length: RealItem<Data.Number>
          }
        }

        return meta
      }

      if (isTypedArray(data)) {
        const meta: Data.TypedArray = {
          "@t": "typedarray",
          "@first": first,
          "@size": data.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "@name": (data as unknown as any)[Symbol.toStringTag],
          "@real": encodeObject(
            data,
            getOwnDescriptorsTypedArray(data)
          ) as Data.TypedArray["@real"]
        }

        return meta
      }

      if (isCollection(data)) {
        const meta: Data.Collection = {
          "@t": "collection",
          "@name": toString.call(data).slice(8, -1) as Data.Collection["@name"],
          "@size": (data as Set<unknown>).size ?? null,
          "@entries": Array.from(
            (data as unknown as Map<unknown, unknown>).entries?.() ?? []
          ).map(([key, val]) => [
            Encode(key, false, true),
            Encode(val, false, true)
          ]),
          "@real": {
            size: createRealItem(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Encode(
                (data as unknown as any).size,
                false,
                false
              ) as Data.Number,
              true
            ),
            // わかない。ぜんぜんわかない！
            ...encodeObject(data)
          }
        }
        return meta
      }

      if (isBuffer(data)) {
        const meta: Data.Buffer = {
          "@t": "buffer",
          "@first": first,
          "@size": data.byteLength,
          "@name": getObjectName(data),
          "@real": {
            ...encodeObject(data),
            "[[Int8Array]]": createRealItem(
              Encode(new Int8Array(data), false, true) as Data.TypedArray,
              true
            ),
            "[[Uint8Array]]": createRealItem(
              Encode(new Uint8Array(data), false, true) as Data.TypedArray,
              true
            ),

            "[[Int16Array]]": createRealItem(
              Encode(new Int16Array(data), false, true) as Data.TypedArray,
              true
            ),
            "[[Int32Array]]": createRealItem(
              Encode(new Int32Array(data), false, true) as Data.TypedArray,
              true
            ),

            "[[ArrayBufferByteLength]]": createRealItem(
              Encode(data.byteLength, false, true) as Data.Number,
              true
            )
          } as Data.Buffer["@real"]
        }

        return meta
      }

      if (isPromise(data)) {
        // const { state, value } = await getStatePromise(data)

        const meta: Data.Promise = {
          "@t": "promise",
          "@first": first,
          "@state": "pending", //state,
          "@real": {
            ...encodeObject(data)
            // "[[PromiseState]]" : Encode(state),
            // "[[PromiseResult]]": Encode(value)
          }
        }

        return meta
      }

      //なんで？
      if (linkReal && isDom(data)) {
        const attrs =
          first && data instanceof Element
            ? Array.from(data.attributes).map((item): [string, string] => [
                item.name,
                item.value
              ])
            : undefined
        switch (data.nodeType) {
          case Node.ELEMENT_NODE: {
            return {
              "@t": "element",
              "@name": data.nodeName,
              "@first": first,
              "@attrs": attrs,
              "@real": first ? undefined : createLinkObject(data),
              "@childs": shouldInline(data)
                ? data.textContent
                : createLinkObject(data.childNodes)
            }
          }
          case Node.TEXT_NODE:
          case Node.CDATA_SECTION_NODE:
          case Node.COMMENT_NODE: {
            return {
              "@t": "element", //  #text
              "@name": data.nodeName,
              "@first": first,
              "@attrs": attrs,
              "@real": first ? undefined : createLinkObject(data),
              "@childs": data.textContent
            }
          }
          case Node.PROCESSING_INSTRUCTION_NODE:
            return {
              "@t": "element",
              "@name": data.nodeName, // ?
              "@first": first,
              "@attrs": attrs,
              "@real": first ? undefined : createLinkObject(data)
            }
          case Node.DOCUMENT_TYPE_NODE:
            return {
              "@t": "element",
              "@name": data.nodeName, // html
              "@first": first,
              "@attrs": attrs,
              "@real": first ? undefined : createLinkObject(data),
              "@childs": `<!DOCTYPE ${(data as unknown as DocumentType).name} ${
                (data as unknown as DocumentType).publicId
                  ? ` PUBLIC "${(data as unknown as DocumentType).publicId}"`
                  : ""
              } ${
                !(data as unknown as DocumentType).publicId &&
                (data as unknown as DocumentType).systemId
                  ? " SYSTEM"
                  : ""
              } ${
                (data as unknown as DocumentType).systemId
                  ? ` "${(data as unknown as DocumentType).systemId}"`
                  : ""
              } >`
            }
          case Node.DOCUMENT_NODE:
            return {
              "@t": "element",
              "@name": data.nodeName, // #document
              "@first": first,
              "@attrs": attrs,
              "@real": first ? undefined : createLinkObject(data)
            }
          case Node.DOCUMENT_FRAGMENT_NODE:
            return {
              "@t": "element",
              "@name": data.nodeName, // #document-fragment
              "@first": first,
              "@attrs": attrs
            }
          default:
            return {
              "@t": "element",
              "@name":
                "#" +
                  nameByNodeType[
                    data.nodeType as keyof typeof nameByNodeType
                  ] ?? "#unknown",
              "@first": first,
              "@real": first ? undefined : createLinkObject(data)
            }
        }
      }

      // getsyoubi no tawata
      const meta: Data.Record = {
        "@t": "object",
        "@name": data.constructor?.name ?? null,
        "@first": first,
        // わかない。ぜんぜんわかない！
        "@real": linkReal ? createLinkObject(data) : encodeObject(data),
        "@des": linkReal ? createPreviewObject(data) : null
      }
      return meta
    }
    // undefined, object, function
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DataPreview {
  export type Record = Pick<Data.Record, "@t" | "@name">
  export type Error = Pick<Data.Error, "@t" | "@stack">
  export type RegExp = Pick<Data.RegExp, "@t" | "@name">
  export type Collection = Pick<Data.Collection, "@t" | "@name" | "@size">
  export type Array = Pick<Data.Array, "@t" | "@size" | "@name">
  export type Function = Pick<Data.Function, "@t" | "@name">
  export type Element = Pick<Data.Element, "@t" | "@name">
  export type Promise = Pick<Data.Promise, "@t">
  export type Date = Pick<Data.Date, "@t" | "@value">
  export type TypedArray = Pick<Data.TypedArray, "@t" | "@size" | "@name">
  export type Buffer = Pick<Data.Buffer, "@t" | "@size" | "@name">

  export interface objReal {
    [name: string]: RealItem<
      | Record
      | Error
      | RegExp
      | Collection
      | Array
      // eslint-disable-next-line @typescript-eslint/ban-types
      | Function
      | Element
      | Promise
      | Date
      | TypedArray
      | Buffer
      | Data.String
      | Data.Number
      | Data.BigInt
      | Data.Symbol
      | Data.Nill
    >
  }
}
/**
 * @description show prototype public
 */
function createPreviewObject(data: object): {
  "@value": DataPreview.objReal
  "@lastKey": string
} {
  let lastKey: string | number | symbol = ""
  const meta = Object.fromEntries(
    entries(getOwnDescriptorsIn(data)).map(
      ([name, meta]): [string, DataPreview.objReal[""]] => {
        lastKey = name
        const { value } = meta
        if (value instanceof Error) {
          return [
            name,
            createRealItem(
              {
                "@t": "error",
                "@stack":
                  value.stack?.split("\n", 3).slice(0, 3).join("\n") ?? ""
              },
              !meta.enumerable
            )
          ]
        }
        if (value instanceof RegExp) {
          return [
            name,
            createRealItem(
              {
                "@t": "regexp",
                "@name": value + ""
              },
              !meta.enumerable
            )
          ]
        }
        if (value instanceof Date) {
          return [
            name,
            createRealItem(
              {
                "@t": "date",
                "@value": value.toString()
              },
              !meta.enumerable
            )
          ]
        }
        if (isCollection(value)) {
          return [
            name,
            createRealItem(
              {
                "@t": "collection",
                "@name": toString
                  .call(value)
                  .slice(8, -1) as Data.Collection["@name"],
                "@size": (value as Set<unknown>).size ?? null
              },
              !meta.enumerable
            )
          ]
        }
        if (isList(value)) {
          return [
            name,
            createRealItem(
              {
                "@t": "array",
                "@name": value instanceof NodeList ? "NodeList" : undefined,
                "@size": value.length
              },
              !meta.enumerable
            )
          ]
        }
        if (isTypedArray(value)) {
          return [
            name,
            createRealItem(
              {
                "@t": "typedarray",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                "@name": (value as unknown as any)[Symbol.toStringTag],
                "@size": value.length
              },
              !meta.enumerable
            )
          ]
        }
        if (isBuffer(value)) {
          return [
            name,
            createRealItem(
              {
                "@t": "buffer",
                "@name": getObjectName(value),
                "@size": value.byteLength
              },
              !meta.enumerable
            )
          ]
        }

        if (isDom(value)) {
          return [
            name,
            createRealItem(
              {
                "@t": "element",
                "@name": value.nodeName
              },
              !meta.enumerable
            )
          ]
        }

        if (isPromise(value)) {
          return [
            name,
            createRealItem(
              {
                "@t": "promise"
              },
              !meta.enumerable
            )
          ]
        }

        if (value !== null && typeof value === "object") {
          return [
            name,
            createRealItem(
              {
                "@t": "object",
                "@name": value.constructor?.name ?? null
              },
              !meta.enumerable
            )
          ]
        }
        if (typeof value === "function") {
          return [
            name,
            createRealItem(
              {
                "@t": "function",
                "@name": ""
              },
              !meta.enumerable
            )
          ]
        }

        return [
          name,
          createRealItem(Encode(value, false, true), !meta.enumerable)
        ]
      }
    )
  )

  return {
    "@value": meta,
    "@lastKey": lastKey
  }
}
function encodeObject(
  data: object | Function | RegExp,
  extendsPropertyDescriptors?: Record<string, PropertyDescriptor>,
  proto: object | Function = Object.getPrototypeOf(data)
): Data.objReal {
  const meta = Object.fromEntries(
    entries(
      Object.assign(
        getOwnDescriptorsIn(data),
        Object.getOwnPropertyDescriptors(data),
        extendsPropertyDescriptors //data instanceof RegExp ? getOwnDescriptorsRegExp(data) : undefined
      )
    ).map(([name, meta]): [string, Data.objReal[""]] => {
      const { value } = meta
      if ("get" in meta || "set" in meta) {
        const at: Partial<Record<"get" | "set", Data.Function>> = {}
        if (meta.get) at.get = Encode(meta.get, false, false) as Data.Function
        if (meta.set) at.set = Encode(meta.set, false, false) as Data.Function
        return [
          name.toString(),
          createRealItem(
            {
              "@t": "gs",
              "@value": createLinkObject(() => getValue(data, name, data)), //meta.get?.(),
              "@at": at
            },
            !meta.enumerable
          )
        ]
      }
      if (
        value !== null &&
        typeof value === "object" &&
        !(value instanceof RegExp) &&
        !isCollection(value) &&
        !(value instanceof Error) &&
        !isList(value)
      ) {
        return [
          name.toString(),
          createRealItem(
            Encode(value, false, true), //createLinkObject(value),
            !meta.enumerable
          )
        ]
      }
      if (typeof value === "function") {
        return [
          name.toString(),
          createRealItem(
            Encode(value, false, true), //createLinkObject(value),
            !meta.enumerable
          )
        ]
      }

      return [
        name.toString(),
        createRealItem(Encode(value, false, true), !meta.enumerable)
      ]
    })
  )

  return Object.assign(meta, {
    "[[Prototype]]": createRealItem(Encode(proto, false, true), true)
  })
}
/// ===================== On The Road! たのたぴたぢたの。さなたびさにどさ =====================
