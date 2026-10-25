<script lang="ts">
  import Sheet from '../lib/components/Sheet.svelte'
  import { errorMessage } from '../lib/http'
  import type { AdminClient } from './api'
  import type { AdminRoom, DeleteTarget } from './types'
  import DeleteRooms from './DeleteRooms.svelte'

  type Action =
    | { kind: 'access'; instance: string; locked: boolean }
    | { kind: 'kick'; instance: string; playerId: string; name: string }
  let {
    room,
    client,
    busy,
    reduced,
    onbegin,
    onend,
    onupdated,
    onremoved,
    onerror,
  }: {
    room: AdminRoom
    client: AdminClient
    busy: boolean
    reduced: boolean
    onbegin: () => void
    onend: () => void
    onupdated: (room: AdminRoom) => void
    onremoved: () => void
    onerror: (error: unknown) => void
  } = $props()
  let action = $state<Action | null>(null)
  let targets = $state<DeleteTarget[] | null>(null)
  let removed = $state(false)
  let working = $state(false)
  let error = $state('')
  let members = $derived([
    ...room.state.players
      .filter((p) => !room.bots?.[p.id] && !room.departed?.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.id === room.host_id ? '房主' : '玩家',
      })),
    ...(room.spectators ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      role: `${p.id === room.host_id ? '房主 · ' : ''}${p.next_round ? '观战 · 下局入座' : '观战'}`,
    })),
  ])
  function begin(next: Action) {
    error = ''
    action = next
    onbegin()
  }
  function close() {
    if (working) return
    action = null
    error = ''
    onend()
  }
  async function apply() {
    if (!action || working) return
    const request = action
    working = true
    error = ''
    try {
      const updated =
        request.kind === 'access'
          ? await client.access(room.id, request.instance, request.locked)
          : await client.kick(room.id, request.playerId, request.instance)
      onupdated(updated)
      action = null
      onend()
    } catch (value) {
      error = errorMessage(value)
      onerror(value)
    } finally {
      working = false
    }
  }
</script>

<div class="admin-room-actions">
  <div>
    <strong>{room.join_locked ? '加入已锁定' : '开放加入'}</strong>
    <p class="admin-muted">
      {room.join_locked ? '已有成员仍可重连。' : '新成员可加入或观战。'}
    </p>
  </div>
  <button
    class="admin-button"
    disabled={busy}
    onclick={() =>
      begin({
        kind: 'access',
        instance: room.instance,
        locked: !room.join_locked,
      })}>{room.join_locked ? '解除锁定' : '锁定加入'}</button
  >
  <button
    class="admin-button danger"
    disabled={busy}
    onclick={() => {
      targets = [
        { id: room.id, instance: room.instance, phase: room.state.phase },
      ]
      removed = false
      onbegin()
    }}>解散 / 删除</button
  >
</div>
<details class="admin-members admin-panel">
  <summary
    >成员管理 <span class="admin-muted">{members.length} 位真人</span></summary
  >
  <div class="admin-member-list">
    {#each members as member (member.id)}
      <div class="admin-member">
        <div>
          <strong>{member.name}</strong><span class="admin-muted"
            >{member.role}</span
          >
        </div>
        <button
          class="admin-button danger"
          disabled={busy || members.length < 2}
          title={members.length < 2 ? '最后一名真人请使用解散房间' : undefined}
          aria-label={`移出 ${member.name}`}
          onclick={() =>
            begin({
              kind: 'kick',
              instance: room.instance,
              playerId: member.id,
              name: member.name,
            })}>移出</button
        >
      </div>
    {/each}
    {#if members.length < 2}<p class="admin-muted">
        最后一名真人请通过解散房间移除。
      </p>{/if}
  </div>
</details>
<Sheet
  open={action !== null}
  title={action?.kind === 'kick'
    ? '移出成员'
    : action?.locked
      ? '锁定加入'
      : '解除锁定'}
  {reduced}
  onclose={close}
>
  <div class="admin-action-form">
    {#if action?.kind === 'kick'}
      <p class="admin-confirm-name">{action.name}</p>
      <p>
        将撤销该成员的房间凭证；正在对局的玩家会弃权。房间开放时，该账户仍可重新加入。
      </p>
    {:else}<p>
        {action?.locked
          ? '锁定后不再接受新玩家或新观众，已有成员可正常重连。'
          : '解除锁定后，新玩家和新观众可以加入房间。'}
      </p>{/if}
    {#if error}<p class="admin-error" role="alert">{error}</p>{/if}
    <div class="admin-form-actions">
      <button class="admin-button" disabled={working} onclick={close}
        >取消</button
      ><button
        class="admin-button"
        class:danger={action?.kind === 'kick'}
        disabled={working}
        onclick={apply}>{working ? '正在处理…' : '确认'}</button
      >
    </div>
  </div>
</Sheet>
{#if targets}
  <DeleteRooms
    {targets}
    {client}
    {reduced}
    {onerror}
    oncomplete={(result) => {
      removed =
        result.results[0]?.status === 'deleted' ||
        result.results[0]?.status === 'not_found'
    }}
    onclose={() => {
      targets = null
      if (removed) onremoved()
      else onend()
    }}
  />
{/if}
