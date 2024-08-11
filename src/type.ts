import type { JsonValue, Promisable } from 'type-fest'
import type { Endpoint } from 'ext-msg'
/**
 * Tail<T> returns a tuple with the first element removed
 * so Tail<[1, 2, 3]> is [2, 3]
 * (works by using rest tuples)
 */
export type Tail<T> = T extends [unknown, ...infer TailType] ? TailType : T

/**
 * Head<T> returns first element type
 * so Head<[1, 2, 3]> is 1
 * (works by using rest tuples)
 */
export type Head<T> = T extends [infer HeadType, ...unknown[]] ? HeadType : T

/**
 * A type that ensures a service has only async methods.
 * - ***If all methods are async***, it returns the original type.
 * - ***If the service has non-async methods***, it returns a `DeepAsync` of the service.
 */
export type RPCService<TService> = TService extends DeepAsync<TService>
  ? TService
  : DeepAsync<TService>

/**
 * A recursive type that deeply converts all methods in `TService` to be async.
 */
type DeepAsync<TService> = TService extends (...args: any) => unknown
  ? ToAsyncFunction<TService>
  : TService extends { [key: string]: any }
    ? {
        [fn in keyof TService]: DeepAsync<TService[fn]>;
      }
    : never

type ToAsyncFunction<T extends (...args: unknown[]) => unknown> = (
  ...args: Tail<Parameters<T>>
) => Promisable<ReturnType<T>>

type Unpacked<T> = T extends Array<infer U>
  ? U
  : T extends ReadonlyArray<infer U>
    ? U
    : T

export interface RPCMessage {
  sender: Endpoint
  id: string
  timestamp: number
}
type GoodFuncParamType = JsonValue | unknown

type GoodFuncReturnType = Promise<JsonValue> | JsonValue | void | Promise<void>

type GoodParamsHead<T> = Head<T> extends RPCMessage ? any : unknown

type GoodParamsTail<T> = Tail<T> extends []
  ? GoodParamsHead<T>
  : [Exclude<Unpacked<Tail<T>>, GoodFuncParamType>] extends [never]
      ? GoodParamsHead<T>
      : unknown

type GoodParams<T> = T extends GoodParamsHead<T> ? GoodParamsTail<T> : never

type GoodFunc<T extends (...args: any) => any> = (
  ...args: GoodParams<Parameters<T>>[]
) => GoodFuncReturnType

type IRPCServiceInternal<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any ? GoodFunc<T[K]> : never;
}

export type IRPCService<T> = T extends (...args: any) => any
  ? GoodFunc<T>
  : IRPCServiceInternal<T>

export interface IRPCMessaging {
  [key: string]: (message: { args: any[], path: string | null }) => unknown
}

export interface IService { [key: string]: unknown }
