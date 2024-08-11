import type { Destination } from 'ext-msg'
import { io } from 'ext-msg'
import type { IRPCMessaging, IRPCService, IService, RPCService } from './type'

/**
 * Create and returns a "deep" proxy. Every property that is accessed returns another proxy, and
 * when a function is called at any depth (0 to infinity), a message is sent to the background.
 */
export function createProxy<TService>(
  messageKey: string,
  destination: Destination,
  path?: string,
): RPCService<TService> {
  const wrapped = (() => { }) as RPCService<TService>

  const proxy = new Proxy(wrapped, {
    // Executed when the object is called as a function
    apply(_target, _thisArg, args) {
      const { send } = io<IRPCMessaging>()

      return send(
        messageKey,
        {
          args,
          path: path ?? null,
        },
        destination,
      )
    },

    // Executed when accessing a property on an object
    get(target, propertyName, receiver) {
      if (propertyName === '__proxy' || typeof propertyName === 'symbol')
        return Reflect.get(target, propertyName, receiver)

      return createProxy(
        messageKey,
        destination,
        path == null ? propertyName : `${path}.${propertyName}`,
      )
    },
  })

  // @ts-expect-error: Adding a hidden property
  proxy.__proxy = true

  return proxy
}

/**
 * generate the message key
 * @param serviceName
 * @returns
 */
export function genMsgKey(serviceName: string): string {
  return `msg-rpc.${serviceName}`
}

const RegisteredServices = new Set<string>()

export function getRPCService<
    TService extends IRPCService<unknown> & object & Check,
    Check = TService extends IRPCService<TService> ? unknown : never,
>(serviceName: string, destination: Destination): RPCService<TService> {
  return createProxy(genMsgKey(serviceName), destination)
}

export function registerRPCService<
    TService extends IRPCService<unknown> & object & Check,
    Check = TService extends IRPCService<TService> ? unknown : never,
>(serviceName: string, service: TService): void {
  if (RegisteredServices.has(serviceName))
    throw new Error(`Service ${serviceName} already registered`)

  const messageKey = genMsgKey(serviceName)
  const Service: IService = service

  const { on } = io<IRPCMessaging>()

  on(messageKey, ({ data, ...message }) => {
    if (
      typeof data !== 'object'
      || data == null
      || !('path' in data)
      || !('args' in data)
      || !Array.isArray(data.args)
    ) {
      throw new Error(
                `Invalid message received for msg-rpc-service "${serviceName}": ${JSON.stringify(
                    data,
                    undefined,
                    2,
                )}`,
      )
    }

    const path: string | null
            = data.path == null || typeof data.path !== 'string' ? null : data.path
    const serviceCb = path == null ? Service : Service[path]
    if (typeof serviceCb !== 'function') {
      throw new TypeError(
                `Invalid message received for -rpc-service "${serviceName}": ${path != null
                    ? `Can't find method "${path}`
                    : 'Expected service to be a function'
                }"`,
      )
    }

    return Promise.resolve(serviceCb.bind(service)(message, ...data.args))
  })

  RegisteredServices.add(serviceName)
}
