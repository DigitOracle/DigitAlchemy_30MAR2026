import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({
    serviceName: 'digitalchemy-console',
  })
}
