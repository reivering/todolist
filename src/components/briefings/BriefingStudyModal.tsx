'use client'

import { useState, useEffect } from 'react'
import type { Flashcard, Note } from '@/types'
import { cn } from '@/lib/utils'
import {
  X, RotateCcw, Shuffle, ArrowLeftRight,
  CheckCircle2, XCircle, Trophy, Layers, BookMarked,
} from 'lucide-react'

interface BriefingStudyModalProps {
  open: boolean
  briefingTitle: string
  notes: Note[]           // notes in the briefing (for grouping label)
  cards: Flashcard[]      // all flashcards from all briefing notes
  onClose: () => void
}

export function BriefingStudyModal({ open, briefingTitle, notes, cards: initialCards, onClose }: BriefingStudyModalProps) {
  const [queue, setQueue] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const [unknown, setUnknown] = useState<Set<string>>(new Set())
  const [done, setDone] = useState(false)
  const [shuffled, setShuffled] = useState(false)
  const [flipMode, setFlipMode] = useState(false)

  function buildQueue(src: Flashcard[], shuffle: boolean) {
    return shuffle ? [...src].sort(() => Math.random() - 0.5) : [...src]
  }

  function reset(src = initialCards, shuffle = shuffled, flip = flipMode) {
    setQueue(buildQueue(src, shuffle))
    setShuffled(shuffle)
    setFlipMode(flip)
    setIndex(0); setFlipped(false)
    setKnown(new Set()); setUnknown(new Set()); setDone(false)
  }

  useEffect(() => {
    if (open) reset(initialCards, false, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCards])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (done) return
      const card = queue[index]
      if (!card) return
      if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setFlipped(f => !f) }
      if (e.key === 'ArrowRight' && flipped) markKnown()
      if (e.key === 'ArrowLeft' && flipped) markUnknown()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done, index, flipped, queue])

  const card = queue[index]
  const front = flipMode ? card?.back : card?.front
  const back = flipMode ? card?.front : card?.back
  const noteTitle = (noteId: string) => notes.find(n => n.id === noteId)?.title ?? ''
  const progress = queue.length > 0 ? ((known.size + unknown.size) / queue.length) * 100 : 0

  function advance() {
    setFlipped(false)
    setTimeout(() => {
      if (index + 1 >= queue.length) setDone(true)
      else setIndex(i => i + 1)
    }, 150)
  }

  function markKnown() {
    setKnown(prev => new Set([...prev, card.id]))
    advance()
  }

  function markUnknown() {
    setUnknown(prev => new Set([...prev, card.id]))
    advance()
  }

  function restudyUnknown() {
    const missed = queue.filter(c => unknown.has(c.id))
    reset(missed, shuffled, flipMode)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl mx-4 flex flex-col"
        style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookMarked size={15} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{briefingTitle}</h2>
              <p className="text-xs text-slate-500">{queue.length} card{queue.length !== 1 ? 's' : ''} · {notes.length} note{notes.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Shuffle toggle */}
            <button
              onClick={() => reset(initialCards, !shuffled, flipMode)}
              title="Shuffle"
              className={cn('p-2 rounded-lg transition-colors', shuffled ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-800')}
            >
              <Shuffle size={14} />
            </button>
            {/* Flip mode toggle */}
            <button
              onClick={() => reset(initialCards, shuffled, !flipMode)}
              title="Flip mode (answer → question)"
              className={cn('p-2 rounded-lg transition-colors', flipMode ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-800')}
            >
              <ArrowLeftRight size={14} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {initialCards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <Layers size={24} className="text-indigo-300" />
              </div>
              <p className="text-sm font-medium text-slate-300 mb-1">No flashcards in this briefing</p>
              <p className="text-xs text-slate-500 max-w-xs">Open the notes in this briefing and add flashcards to start studying.</p>
            </div>
          ) : done ? (
            <CompletionScreen
              queue={queue}
              known={known}
              unknown={unknown}
              onReset={() => reset(initialCards, shuffled, flipMode)}
              onRestudyUnknown={restudyUnknown}
            />
          ) : (
            <div className="flex-1 flex flex-col p-6">
              {/* Progress */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">{index + 1} / {queue.length}</span>
              </div>

              {/* Note label */}
              {card && (
                <p className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  {noteTitle(card.note_id)}
                </p>
              )}

              {/* Flip card */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-lg cursor-pointer select-none" style={{ perspective: 1200 }} onClick={() => setFlipped(f => !f)}>
                  <div
                    className="relative w-full"
                    style={{
                      height: 220,
                      transformStyle: 'preserve-3d',
                      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                    }}
                  >
                    {/* Front */}
                    <div
                      className="absolute inset-0 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 flex flex-col items-center justify-center px-8 py-6 shadow-lg"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest mb-4">
                        {flipMode ? 'Answer' : 'Question'}
                      </span>
                      <p className="text-xl font-semibold text-slate-100 text-center leading-snug">{front}</p>
                      <span className="text-xs text-indigo-300 mt-5">Click to reveal</span>
                    </div>

                    {/* Back */}
                    <div
                      className="absolute inset-0 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center px-8 py-6 shadow-lg"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mb-4">
                        {flipMode ? 'Question' : 'Answer'}
                      </span>
                      <p className="text-lg text-slate-200 text-center leading-relaxed">{back}</p>
                    </div>
                  </div>
                </div>

                {flipped ? (
                  <div className="flex items-center gap-4 mt-8">
                    <button onClick={markUnknown}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100">
                      <XCircle size={16} /> Still learning
                    </button>
                    <button onClick={markKnown}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-100">
                      <CheckCircle2 size={16} /> Got it!
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-6">
                    Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">Space</kbd> to flip
                    {' · '}
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">→</kbd> Got it
                    {' · '}
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">←</kbd> Still learning
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CompletionScreen({ queue, known, unknown, onReset, onRestudyUnknown }: {
  queue: Flashcard[]; known: Set<string>; unknown: Set<string>
  onReset: () => void; onRestudyUnknown: () => void
}) {
  const pct = Math.round((known.size / queue.length) * 100)
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
        <Trophy size={28} className="text-indigo-500" />
      </div>
      <h3 className="text-lg font-bold text-slate-100 mb-1">Round complete!</h3>
      <p className="text-sm text-slate-400 mb-6">
        {known.size} known · {unknown.size} to review · {pct}% score
      </p>

      <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-3">
        {unknown.size > 0 && (
          <button onClick={onRestudyUnknown}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            <RotateCcw size={14} /> Study missed ({unknown.size})
          </button>
        )}
        <button onClick={onReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-900/50">
          <RotateCcw size={14} /> Start over
        </button>
      </div>
    </div>
  )
}
