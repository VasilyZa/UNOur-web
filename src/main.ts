import { mount } from 'svelte'
import './app.css'

// Administration has no game navigation entry and is loaded only by its URL.
async function start() {
  const { default: App } = /^\/admin\/?$/.test(location.pathname)
    ? await import('./admin/AdminApp.svelte')
    : await import('./App.svelte')
  return mount(App, { target: document.getElementById('app')! })
}
export default start()
