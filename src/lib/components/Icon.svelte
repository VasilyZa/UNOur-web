<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props()
  const paths: Record<string, string> = {
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    back: 'm14 6-6 6 6 6',
    plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M6 18 18 6',
    menu: 'M5 7h14M5 12h14M5 17h14',
    settings: 'M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M8 14v6',
    users:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    copy: 'M9 9h11v12H9zM15 9V3H3v12h6',
    cards: 'm9 3 11 3-4 15-11-3L9 3ZM5 5 2 17l3 1',
    sort: 'M5 5v14m-3-3 3 3 3-3M11 5h10M11 10h7M11 15h4',
    check: 'm5 12 4 4L19 6',
    info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    sound: 'm11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    reset: 'M3 11a9 9 0 1 1 2 7M3 4v7h7',
    link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
    clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    trophy:
      'M8 3h8v8a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v5m-4 1h8',
    leaf: 'M20 3C9 2 2 7 5 15c3 8 16 4 15-12ZM5 20 16 9',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
    chevron: 'm8 5 7 7-7 7',
    exit: 'M9 4H4v16h5m5-14 6 6-6 6m-5-6h11',
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={paths[name] || paths.info} />
</svg>
