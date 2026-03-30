'use client'

import { useState, useEffect, useRef } from 'react'
import type { Priority } from '@/types'
import { cn } from '@/lib/utils'
import { Mic, MicOff, X, Check, Trash2, ChevronDown, Loader2 } from 'lucide-react'

interface ParsedTask {
  title: string
  priority: Priority
}

interface VoiceDictationModalProps {
  open: boolean
  onClose: () => void
  onSave: (tasks: ParsedTask[]) => Promise<void>
}

// ── Priority detection ──────────────────────────────────────────────────────
const HIGH_KEYWORDS = [
  'urgent', 'critical', 'asap', 'immediately', 'emergency', 'deadline',
  'must', 'today', 'right away', 'important', 'priority', 'crucial', 'vital',
]
const LOW_KEYWORDS = [
  'eventually', 'someday', 'maybe', 'when possible', 'if possible',
  'low priority', 'minor', 'optional', 'later', 'sometime', 'no rush',
]

function detectPriority(text: string): Priority {
  const lower = text.toLowerCase()
  if (HIGH_KEYWORDS.some(k => lower.includes(k))) return 'high'
  if (LOW_KEYWORDS.some(k => lower.includes(k))) return 'low'
  return 'medium'
}

// ── Task splitting ──────────────────────────────────────────────────────────
function parseTasksFromTranscript(transcript: string): ParsedTask[] {
  // Split on common verbal separators
  const raw = transcript
    .replace(/\b(first(?:ly)?|number one|one[,.])\b/gi, '|')
    .replace(/\b(second(?:ly)?|number two|two[,.])\b/gi, '|')
    .replace(/\b(third(?:ly)?|number three|three[,.])\b/gi, '|')
    .replace(/\b(fourth|number four|four[,.])\b/gi, '|')
    .replace(/\b(fifth|number five|five[,.])\b/gi, '|')
    .replace(/\b(also|then|next|after that|and then|additionally)\b/gi, '|')
    .split(/[|,]|\band\b/)
    .map(s => s.trim())
    .filter(s => s.length > 3)

  // Sort by detected priority: high → medium → low
  const tasks: ParsedTask[] = raw.map(title => ({
    title: title.charAt(0).toUpperCase() + title.slice(1).replace(/[.!?]+$/, ''),
    priority: detectPriority(title),
  }))

  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
  return tasks.sort((a, b) => order[a.priority] - order[b.priority])
}

// ── Priority badge ──────────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<Priority, { badge: string; dot: string; label: string }> = {
  high:   { badge: 'bg-red-50 text-red-600 border border-red-200',       dot: 'bg-red-500',    label: 'High' },
  medium: { badge: 'bg-amber-50 text-amber-600 border border-amber-200', dot: 'bg-amber-400',  label: 'Medium' },
  low:    { badge: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-emerald-500',label: 'Low' },
}

export function VoiceDictationModal({ open, onClose, onSave }: VoiceDictationModalProps) {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [tasks, setTasks] = useState<ParsedTask[]>([])
  const [saving, setSaving] = useState(false)
  const [supported, setSupported] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (typeof window !== 'undefined') &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SR) { setSupported(false); return }

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (final) setTranscript(prev => (prev + ' ' + final).trim())
      setInterimText(interim)
    }

    rec.onerror = () => setRecording(false)
    rec.onend = () => { setRecording(false); setInterimText('') }

    recognitionRef.current = rec
  }, [])

  // Reset when opened
  useEffect(() => {
    if (open) { setTranscript(''); setInterimText(''); setTasks([]) }
    else stopRecording()
  }, [open])

  function startRecording() {
    setTranscript(''); setInterimText(''); setTasks([])
    recognitionRef.current?.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  function processTranscript() {
    const full = (transcript + ' ' + interimText).trim()
    if (!full) return
    stopRecording()
    setTasks(parseTasksFromTranscript(full))
  }

  function removeTask(i: number) {
    setTasks(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateTask(i: number, field: 'title' | 'priority', value: string) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  async function handleSave() {
    if (tasks.length === 0) return
    setSaving(true)
    await onSave(tasks)
    setSaving(false)
    onClose()
  }

  if (!open) return null

  const fullTranscript = (transcript + ' ' + interimText).trim()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-700 w-full max-w-lg mx-0 sm:mx-4 flex flex-col"
        style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-colors', recording ? 'bg-red-100' : 'bg-slate-800')}>
              <Mic size={15} className={recording ? 'text-red-500' : 'text-slate-400'} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Voice Dictation</h2>
              <p className="text-xs text-slate-500">Speak your tasks — priority is detected automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {!supported ? (
            <div className="text-center py-8 text-sm text-slate-500">
              Speech recognition is not supported in this browser. Try Chrome or Edge.
            </div>
          ) : tasks.length === 0 ? (
            <>
              {/* Recording area */}
              <div className={cn(
                'relative min-h-[120px] rounded-2xl border-2 border-dashed p-5 transition-all',
                recording ? 'border-red-300 bg-red-50/40' : 'border-slate-700 bg-slate-900/40'
              )}>
                {recording && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs text-red-500 font-medium">Recording</span>
                  </div>
                )}

                {fullTranscript ? (
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {transcript}
                    {interimText && <span className="text-slate-500"> {interimText}</span>}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-4 text-center">
                    <p className="text-sm text-slate-500">
                      {recording ? 'Listening… speak your tasks' : 'Press the mic button to start'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      e.g. "Finish report urgently, call team tomorrow, maybe update the docs later"
                    </p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-2xl text-sm font-medium hover:bg-red-600 shadow-lg shadow-red-200"
                  >
                    <Mic size={15} /> Start recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-2xl text-sm font-medium hover:bg-gray-900"
                  >
                    <MicOff size={15} /> Stop
                  </button>
                )}
                {fullTranscript && !recording && (
                  <button
                    onClick={processTranscript}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-2xl text-sm font-medium hover:bg-violet-700"
                  >
                    <Check size={15} /> Detect tasks
                  </button>
                )}
              </div>

              {/* Hint */}
              {!recording && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-xs text-blue-700 font-medium mb-1">Priority detection keywords</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-violet-600">
                    <span><span className="text-red-500 font-medium">High:</span> urgent, critical, ASAP, today, must</span>
                    <span><span className="text-amber-500 font-medium">Med:</span> (default)</span>
                    <span><span className="text-green-600 font-medium">Low:</span> later, maybe, eventually, optional</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Detected tasks */}
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''} detected — sorted by priority
                </p>
                <button onClick={() => setTasks([])} className="text-xs text-slate-500 hover:text-slate-300">
                  ← Re-record
                </button>
              </div>

              <div className="space-y-2">
                {tasks.map((task, i) => {
                  const s = PRIORITY_STYLES[task.priority]
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                      {/* Priority picker */}
                      <div className="relative flex-shrink-0">
                        <select
                          value={task.priority}
                          onChange={e => updateTask(i, 'priority', e.target.value)}
                          className={cn('text-xs font-semibold px-2 py-1 rounded-lg border appearance-none pr-5 cursor-pointer', s.badge)}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60" />
                      </div>

                      {/* Title */}
                      <input
                        value={task.title}
                        onChange={e => updateTask(i, 'title', e.target.value)}
                        className="flex-1 text-sm text-slate-200 bg-transparent outline-none min-w-0"
                      />

                      <button onClick={() => removeTask(i)} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {tasks.length > 0 && (
          <div className="border-t border-slate-800 px-5 py-4 flex items-center justify-between bg-slate-900/50 rounded-b-2xl">
            <p className="text-xs text-slate-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} will be created</p>
            <button
              onClick={handleSave}
              disabled={saving || tasks.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
