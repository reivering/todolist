'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Briefing } from '@/types'
import { CreateBriefingModal } from '@/components/briefings/CreateBriefingModal'
import { BookMarked, Plus, Trash2, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BriefingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [briefings, setBriefings] = useState<(Briefing & { card_count: number; note_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    const { data: bs } = await supabase
      .from('briefings')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!bs) { setLoading(false); return }

    // For each briefing get note count + flashcard count
    const enriched = await Promise.all(
      bs.map(async (b) => {
        const { data: bnotes } = await supabase
          .from('briefing_notes')
          .select('note_id')
          .eq('briefing_id', b.id)

        const noteIds = (bnotes || []).map(r => r.note_id)
        let cardCount = 0
        if (noteIds.length > 0) {
          const { count } = await supabase
            .from('flashcards')
            .select('*', { count: 'exact', head: true })
            .in('note_id', noteIds)
          cardCount = count ?? 0
        }

        return { ...b, note_count: noteIds.length, card_count: cardCount }
      })
    )

    setBriefings(enriched as (Briefing & { card_count: number; note_count: number })[])
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase])

  async function deleteBriefing(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this briefing?')) return
    await supabase.from('briefings').delete().eq('id', id)
    setBriefings(prev => prev.filter(b => b.id !== id))
    toast.success('Briefing deleted')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/40">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
            <BookMarked size={16} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Briefings</h1>
            {!loading && (
              <p className="text-xs text-gray-400">
                {briefings.length} briefing{briefings.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-sm"
        >
          <Plus size={14} /> New briefing
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : briefings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <BookMarked size={28} className="text-indigo-300" />
            </div>
            <h2 className="text-base font-semibold text-gray-700 mb-2">No briefings yet</h2>
            <p className="text-sm text-gray-400 max-w-xs mb-5">
              A briefing groups notes together so you can read them and study their flashcards as a set.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700"
            >
              <Plus size={14} /> Create your first briefing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {briefings.map(b => (
              <div
                key={b.id}
                onClick={() => router.push(`/briefings/${b.id}`)}
                className="group cursor-pointer text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-150 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BookMarked size={16} className="text-indigo-500" />
                  </div>
                  <div
                    role="button"
                    onClick={(e) => deleteBriefing(b.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-all flex-shrink-0 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug">{b.title}</h3>
                  {b.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{b.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{b.note_count} note{b.note_count !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{b.card_count} card{b.card_count !== 1 ? 's' : ''}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>

                <p className="text-[11px] text-gray-300">{formatDate(b.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateBriefingModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { load(); router.push(`/briefings/${id}`) }}
      />
    </div>
  )
}
