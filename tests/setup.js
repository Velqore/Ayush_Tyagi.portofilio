import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })) })
window.scrollTo = vi.fn()
HTMLElement.prototype.scrollIntoView = vi.fn()
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
HTMLMediaElement.prototype.pause = vi.fn()
URL.createObjectURL = vi.fn(() => 'blob:local-test-video')
URL.revokeObjectURL = vi.fn()
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); vi.clearAllMocks() })
