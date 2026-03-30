'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Flashcard, Note } from '@/types'
import { cn } from '@/lib/utils'
import {
  X, Plus, Trash2, Pencil, RotateCcw,
  Sparkles, BookOpen, Layers, Shuffle, ArrowLeftRight,
  CheckCircle2, XCircle, Trophy,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface FlashcardModalProps {
  note: Note
  userId: string
  open: boolean
  onClose: () => void
}

type Tab = 'deck' | 'study'

export function FlashcardModal({ note, userId, open, onClose }: FlashcardModalProps) {
  const supabase = createClient()
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('deck')

  // Study state
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([])
  const [studyIndex, setStudyIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const [unknown, setUnknown] = useState<Set<string>>(new Set())
  const [studyDone, setStudyDone] = useState(false)
  const [shuffled, setShuffled] = useState(false)
  const [flipMode, setFlipMode] = useState(false)

  // New card form
  const [addingCard, setAddingCard] = useState(false)
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  const loadCards = useCallback(async () => {
    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('note_id', note.id)
      .order('sort_order')
      .order('created_at')
    if (data) setCards(data)
    setLoading(false)
  }, [supabase, note.id])

  useEffect(() => {
    if (open) { setLoading(true); loadCards(); resetStudy(false, false) }
  }, [open, loadCards])

  function resetStudy(shuffle = shuffled, flip = flipMode, source = cards) {
    const order = shuffle ? [...source].sort(() => Math.random() - 0.5) : [...source]
    setStudyQueue(order)
    setShuffled(shuffle)
    setFlipMode(flip)
    setStudyIndex(0); setFlipped(false)
    setKnown(new Set()); setUnknown(new Set()); setStudyDone(false)
  }

  // ── Extract cards from note content ──
  function extractFromNote() {
    if (!note.content) return []
    type InlineNode = { type: string; text?: string; marks?: Array<{ type: string }>; content?: InlineNode[] }
    type Block = { type: string; content?: InlineNode[] }
    const doc = note.content as { content?: Block[] }
    const blocks = doc.content || []
    const pairs: Array<{ front: string; back: string }> = []

    // Helper: get all text from a block (handles nested list items etc.)
    function blockText(block: Block): string {
      function collect(nodes: InlineNode[]): string {
        return nodes.map(n => (n.text || '') + (n.content ? collect(n.content) : '')).join('')
      }
      return collect(block.content || []).trim()
    }

    // Strategy 1: heading → all content until the next heading
    let currentHeading = ''
    let bodyLines: string[] = []

    function flush() {
      if (currentHeading && bodyLines.length > 0) {
        pairs.push({ front: currentHeading, back: bodyLines.join(' ') })
      }
    }

    for (const block of blocks) {
      if (block.type === 'heading') {
        flush()
        currentHeading = blockText(block)
        bodyLines = []
      } else {
        const t = blockText(block)
        if (t) bodyLines.push(t)
      }
    }
    flush()

    // Strategy 2: bold term → rest of paragraph (fallback when no headings)
    if (pairs.length === 0) {
      for (const block of blocks) {
        if (block.type === 'paragraph' && block.content) {
          const bold = block.content.filter(n => n.marks?.some(m => m.type === 'bold') && n.text?.trim())
          const plain = block.content.filter(n => !n.marks?.some(m => m.type === 'bold') && n.text?.trim())
          if (bold.length > 0 && plain.length > 0) {
            const front = bold.map(n => n.text).join(' ').trim()
            const back = plain.map(n => n.text).join(' ').trim()
            if (front && back) pairs.push({ front, back })
          }
        }
      }
    }

    return pairs
  }

  async function handleExtract() {
    const pairs = extractFromNote()
    if (pairs.length === 0) {
      toast.error('No extractable content found. Try adding headings followed by paragraphs, or bold terms.')
      return
    }
    const inserts = pairs.map((p, i) => ({
      user_id: userId, note_id: note.id, front: p.front, back: p.back, sort_order: cards.length + i,
    }))
    const { data } = await supabase.from('flashcards').insert(inserts).select()
    if (data) {
      setCards(prev => [...prev, ...data])
      toast.success(`${data.length} card${data.length !== 1 ? 's' : ''} extracted`)
    }
  }

  async function addCard() {
    if (!newFront.trim() || !newBack.trim()) return
    const { data } = await supabase.from('flashcards').insert({
      user_id: userId, note_id: note.id,
      front: newFront.trim(), back: newBack.trim(), sort_order: cards.length,
    }).select().single()
    if (data) {
      setCards(prev => [...prev, data])
      setNewFront(''); setNewBack(''); setAddingCard(false)
    }
  }

  async function deleteCard(id: string) {
    await supabase.from('flashcards').delete().eq('id', id)
    setCards(prev => prev.filter(c => c.id !== id))
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id); setEditFront(card.front); setEditBack(card.back)
  }

  async function saveEdit(id: string) {
    if (!editFront.trim() || !editBack.trim()) return
    await supabase.from('flashcards').update({ front: editFront.trim(), back: editBack.trim() }).eq('id', id)
    setCards(prev => prev.map(c => c.id === id ? { ...c, front: editFront.trim(), back: editBack.trim() } : c))
    setEditingId(null)
  }

  // ── Study logic ──
  const studyCards = studyQueue.length > 0 ? studyQueue : cards
  const currentCard = studyCards[studyIndex]

  function markKnown() {
    setKnown(prev => new Set([...prev, currentCard.id]))
    advance()
  }

  function markUnknown() {
    setUnknown(prev => new Set([...prev, currentCard.id]))
    advance()
  }

  function advance() {
    setFlipped(false)
    setTimeout(() => {
      if (studyIndex + 1 >= studyCards.length) setStudyDone(true)
      else setStudyIndex(i => i + 1)
    }, 150)
  }

  function restudyUnknown() {
    const unknownCards = studyCards.filter(c => unknown.has(c.id))
    const order = shuffled ? [...unknownCards].sort(() => Math.random() - 0.5) : unknownCards
    setStudyQueue(order)
    setKnown(new Set()); setUnknown(new Set())
    setStudyIndex(0); setFlipped(false); setStudyDone(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (tab === 'study' && !studyDone && currentCard) {
        if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setFlipped(f => !f) }
        if (e.key === 'ArrowRight' && flipped) markKnown()
        if (e.key === 'ArrowLeft' && flipped) markUnknown()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, studyDone, currentCard, flipped])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-2xl mx-4 flex flex-col"
        style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Layers size={15} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Flashcards</h2>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">{note.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => { setTab('deck'); resetStudy() }}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  tab === 'deck' ? 'bg-slate-900 text-slate-100 shadow-lg' : 'text-slate-400 hover:text-slate-200')}
              >
                <BookOpen size={12} /> Deck
              </button>
              <button
                onClick={() => { setTab('study'); resetStudy(shuffled, flipMode, cards) }}
                disabled={cards.length === 0}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  tab === 'study' ? 'bg-slate-900 text-slate-100 shadow-lg' : 'text-slate-400 hover:text-slate-200',
                  cards.length === 0 && 'opacity-40 cursor-not-allowed')}
              >
                <Sparkles size={12} /> Study
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'deck' ? (
            <DeckTab
              cards={cards}
              editingId={editingId}
              editFront={editFront}
              editBack={editBack}
              setEditFront={setEditFront}
              setEditBack={setEditBack}
              addingCard={addingCard}
              newFront={newFront}
              newBack={newBack}
              setNewFront={setNewFront}
              setNewBack={setNewBack}
              onAdd={addCard}
              onDelete={deleteCard}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingId(null)}
              onExtract={handleExtract}
              onStartAdd={() => setAddingCard(true)}
              onCancelAdd={() => { setAddingCard(false); setNewFront(''); setNewBack('') }}
            />
          ) : (
            <StudyTab
              cards={studyCards}
              index={studyIndex}
              flipped={flipped}
              done={studyDone}
              known={known}
              unknown={unknown}
              shuffled={shuffled}
              flipMode={flipMode}
              onFlip={() => setFlipped(f => !f)}
              onKnown={markKnown}
              onUnknown={markUnknown}
              onReset={() => resetStudy(shuffled, flipMode, cards)}
              onRestudyUnknown={restudyUnknown}
              onToggleShuffle={() => resetStudy(!shuffled, flipMode, cards)}
              onToggleFlipMode={() => resetStudy(shuffled, !flipMode, cards)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Deck tab ── */
function DeckTab({
  cards, editingId, editFront, editBack, setEditFront, setEditBack,
  addingCard, newFront, newBack, setNewFront, setNewBack,
  onAdd, onDelete, onStartEdit, onSaveEdit, onCancelEdit,
  onExtract, onStartAdd, onCancelAdd,
}: {
  cards: Flashcard[]
  editingId: string | null
  editFront: string; editBack: string
  setEditFront: (v: string) => void; setEditBack: (v: string) => void
  addingCard: boolean; newFront: string; newBack: string
  setNewFront: (v: string) => void; setNewBack: (v: string) => void
  onAdd: () => void; onDelete: (id: string) => void
  onStartEdit: (c: Flashcard) => void; onSaveEdit: (id: string) => void; onCancelEdit: () => void
  onExtract: () => void; onStartAdd: () => void; onCancelAdd: () => void
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <span className="text-xs text-slate-500 font-medium">
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onExtract}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-dashed border-violet-300 text-violet-600 hover:bg-violet-50"
            title="Extract cards from headings and bold text in the note"
          >
            <Sparkles size={12} />
            Extract from note
          </button>
          <button
            onClick={onStartAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            <Plus size={12} /> Add card
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {/* Add form */}
        {addingCard && (
          <div className="border-2 border-dashed border-violet-200 rounded-xl p-4 bg-violet-50/40">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Front</label>
                <textarea
                  autoFocus
                  value={newFront}
                  onChange={e => setNewFront(e.target.value)}
                  placeholder="Question or term…"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm border border-violet-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Back</label>
                <textarea
                  value={newBack}
                  onChange={e => setNewBack(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.metaKey && onAdd()}
                  placeholder="Answer or definition…"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm border border-violet-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-slate-900"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={onCancelAdd} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900/50">Cancel</button>
              <button onClick={onAdd} disabled={!newFront.trim() || !newBack.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40">
                Save card
              </button>
            </div>
          </div>
        )}

        {/* Cards */}
        {cards.length === 0 && !addingCard ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mb-3">
              <Layers size={22} className="text-violet-400" />
            </div>
            <p className="text-sm font-medium text-slate-300 mb-1">No flashcards yet</p>
            <p className="text-xs text-slate-500 max-w-[220px]">Add cards manually or extract them from your note's headings and bold text.</p>
          </div>
        ) : (
          cards.map((card, i) => (
            <div key={card.id} className="group border border-slate-700 rounded-xl overflow-hidden hover:border-violet-200 hover:shadow-lg">
              {editingId === card.id ? (
                <div className="p-4 bg-violet-50/30">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Front</label>
                      <textarea value={editFront} onChange={e => setEditFront(e.target.value)} rows={3}
                        className="w-full mt-1 px-3 py-2 text-sm border border-violet-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-slate-900" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">Back</label>
                      <textarea value={editBack} onChange={e => setEditBack(e.target.value)} rows={3}
                        className="w-full mt-1 px-3 py-2 text-sm border border-violet-200 rounded-lg outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-slate-900" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={onCancelEdit} className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900/50">Cancel</button>
                    <button onClick={() => onSaveEdit(card.id)} className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white hover:bg-violet-700">Save</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="px-4 py-3">
                    <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">Front</div>
                    <p className="text-sm text-slate-200 leading-relaxed">{card.front}</p>
                  </div>
                  <div className="px-4 py-3 bg-slate-900/50">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Back</div>
                    <p className="text-sm text-slate-300 leading-relaxed">{card.back}</p>
                  </div>
                </div>
              )}
              {editingId !== card.id && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/50">
                  <span className="text-[10px] text-slate-500">Card {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onStartEdit(card)} className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-violet-600">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => onDelete(card.id)} className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-red-500">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Study tab ── */
function StudyTab({
  cards, index, flipped, done, known, unknown, shuffled, flipMode,
  onFlip, onKnown, onUnknown, onReset, onRestudyUnknown, onToggleShuffle, onToggleFlipMode,
}: {
  cards: Flashcard[]; index: number; flipped: boolean; done: boolean
  known: Set<string>; unknown: Set<string>
  shuffled: boolean; flipMode: boolean
  onFlip: () => void; onKnown: () => void; onUnknown: () => void
  onReset: () => void; onRestudyUnknown: () => void
  onToggleShuffle: () => void; onToggleFlipMode: () => void
}) {
  const card = cards[index]
  const progress = cards.length > 0 ? ((known.size + unknown.size) / cards.length) * 100 : 0

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-sm text-slate-500">Add some cards to the deck first.</p>
      </div>
    )
  }

  if (done) {
    const knownCount = known.size
    const unknownCount = unknown.size
    const pct = Math.round((knownCount / cards.length) * 100)
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
          <Trophy size={28} className="text-violet-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-100 mb-1">Round complete!</h3>
        <p className="text-sm text-slate-400 mb-6">{knownCount} known · {unknownCount} to review · {pct}% score</p>

        {/* Score bar */}
        <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex gap-3">
          {unknownCount > 0 && (
            <button onClick={onRestudyUnknown}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">
              <RotateCcw size={14} /> Study missed ({unknownCount})
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

  return (
    <div className="flex-1 flex flex-col p-6">
      {/* Header with toggles */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-slate-500 font-medium">{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleShuffle}
            title="Shuffle"
            className={cn('p-2 rounded-lg transition-colors', shuffled ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-800')}
          >
            <Shuffle size={14} />
          </button>
          <button
            onClick={onToggleFlipMode}
            title="Flip mode (answer → question)"
            className={cn('p-2 rounded-lg transition-colors', flipMode ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-800')}
          >
            <ArrowLeftRight size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">{index + 1} / {cards.length}</span>
      </div>

      {/* Flip card */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className="w-full max-w-lg cursor-pointer select-none"
          style={{ perspective: 1200 }}
          onClick={onFlip}
        >
          <div
            className="relative w-full"
            style={{
              height: 220,
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Front */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 flex flex-col items-center justify-center px-8 py-6 shadow-lg"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-4">Question</span>
              <p className="text-xl font-semibold text-slate-100 text-center leading-snug">{card?.front}</p>
              <span className="text-xs text-violet-300 mt-5">Click to reveal answer</span>
            </div>

            {/* Back */}
            <div
              className="absolute inset-0 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center px-8 py-6 shadow-lg"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest mb-4">Answer</span>
              <p className="text-lg text-slate-200 text-center leading-relaxed">{card?.back}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {flipped ? (
          <div className="flex items-center gap-4 mt-8">
            <button onClick={onUnknown}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100">
              <XCircle size={16} /> Still learning
            </button>
            <button onClick={onKnown}
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
  )
}
