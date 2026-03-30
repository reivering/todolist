'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Note, Flashcard } from '@/types'
import { FlashcardModal } from '@/components/notes/FlashcardModal'
import { Layers, Sparkles, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeckInfo {
  note: Note
  cards: Flashcard[]
}

export default function FlashcardsPage() {
  const supabase = createClient()
  const [decks, setDecks] = useState<DeckInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [activeDeck, setActiveDeck] = useState<DeckInfo | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Load all flashcards with their notes
      const { data: cards } = await supabase
        .from('flashcards')
        .select('*')
        .order('sort_order')
        .order('created_at')

      if (!cards || cards.length === 0) { setLoading(false); return }

      // Get unique note IDs
      const noteIds = [...new Set(cards.map(c => c.note_id))]

      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .in('id', noteIds)
        .eq('is_trashed', false)
        .order('updated_at', { ascending: false })

      if (notes) {
        const deckList: DeckInfo[] = notes.map(note => ({
          note: note as unknown as Note,
          cards: cards.filter(c => c.note_id === note.id),
        }))
        setDecks(deckList)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0)

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
            <Layers size={16} className="text-violet-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100">Flashcards</h1>
        </div>
        <p className="text-sm text-slate-500 ml-11">
          {loading ? '…' : `${decks.length} deck${decks.length !== 1 ? 's' : ''} · ${totalCards} card${totalCards !== 1 ? 's' : ''} total`}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
              <Layers size={28} className="text-violet-300" />
            </div>
            <h2 className="text-base font-semibold text-slate-200 mb-2">No flashcard decks yet</h2>
            <p className="text-sm text-slate-500 max-w-xs">
              Open any note and click <strong>Flashcards</strong> in the toolbar to create your first deck.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {decks.map(deck => (
              <DeckCard
                key={deck.note.id}
                deck={deck}
                onStudy={() => setActiveDeck(deck)}
              />
            ))}
          </div>
        )}
      </div>

      {activeDeck && (
        <FlashcardModal
          note={activeDeck.note}
          userId={userId}
          open={true}
          onClose={() => setActiveDeck(null)}
        />
      )}
    </div>
  )
}

function DeckCard({ deck, onStudy }: { deck: DeckInfo; onStudy: () => void }) {
  const count = deck.cards.length
  const preview = deck.cards.slice(0, 2)

  return (
    <button
      onClick={onStudy}
      className="group text-left bg-slate-900 border border-slate-700 rounded-2xl p-5 hover:border-violet-300 hover:shadow-md transition-all duration-150 flex flex-col gap-4"
    >
      {/* Note icon + title */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileText size={16} className="text-violet-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100 truncate leading-snug">{deck.note.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{count} card{count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Card previews */}
      {preview.length > 0 && (
        <div className="space-y-1.5">
          {preview.map(card => (
            <div key={card.id} className="text-xs text-slate-400 bg-slate-900/50 rounded-lg px-3 py-2 truncate">
              {card.front}
            </div>
          ))}
          {count > 2 && (
            <p className="text-xs text-slate-500 pl-1">+{count - 2} more…</p>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center gap-1.5 mt-auto pt-1">
        <Sparkles size={12} className="text-violet-400 group-hover:text-violet-600 transition-colors" />
        <span className="text-xs text-violet-500 group-hover:text-violet-700 font-medium transition-colors">Study deck</span>
      </div>
    </button>
  )
}
