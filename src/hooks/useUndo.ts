import { useCallback, useRef, useState } from 'react'
import { Command } from '../store/commands'

const MAX_HISTORY = 50

export type RunMode = 'do' | 'undo' | 'redo'

// Undo/redo of the current user's own commands. `run` applies a command and resolves to false on failure.
export function useUndo(run: (cmd: Command, mode: RunMode) => Promise<boolean>) {
  const [past, setPast] = useState<Command[]>([])
  const [future, setFuture] = useState<Command[]>([])
  const busy = useRef(false)

  const execute = useCallback(async (cmd: Command) => {
    if (await run(cmd, 'do')) {
      setPast(p => [...p, cmd].slice(-MAX_HISTORY))
      setFuture([])
    }
  }, [run])

  const undo = useCallback(async () => {
    const cmd = past[past.length - 1]
    if (!cmd || busy.current) return
    busy.current = true
    setPast(p => p.slice(0, -1))
    if (await run(cmd, 'undo')) setFuture(f => [...f, cmd])
    busy.current = false
  }, [past, run])

  const redo = useCallback(async () => {
    const cmd = future[future.length - 1]
    if (!cmd || busy.current) return
    busy.current = true
    setFuture(f => f.slice(0, -1))
    if (await run(cmd, 'redo')) setPast(p => [...p, cmd])
    busy.current = false
  }, [future, run])

  return { execute, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}
