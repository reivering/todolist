'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { NoteTag } from '@/types'
import { TAG_COLORS } from '@/lib/utils'
import { X, Plus, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

interface NoteTagManagerProps {
  noteId: string
  userId: string
  allTags: NoteTag[]
  noteTags: NoteTag[]
  onTagsChange: (tags: NoteTag[]) => void
  onTagsListChange: (tags: NoteTag[]) => void
}

export function NoteTagManager({ noteId, userId, allTags, noteTags, onTagsChange, onTagsListChange }: NoteTagManagerProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  const noteTagIds = new Set(noteTags.map(t => t.id))

  async function toggleTag(tag: NoteTag) {
    if (noteTagIds.has(tag.id)) {
      await supabase.from('note_tag_relations').delete()
        .eq('note_id', noteId).eq('tag_id', tag.id)
      onTagsChange(noteTags.filter(t => t.id !== tag.id))
    } else {
      await supabase.from('note_tag_relations').insert({ note_id: noteId, tag_id: tag.id })
      onTagsChange([...noteTags, tag])
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return
    const { data, error } = await supabase.from('note_tags').insert({
      user_id: userId,
      name: newTagName.trim(),
      color: newTagColor,
    }).select().single()
    if (error) { toast.error('Failed to create tag'); return }
    if (data) {
      const newTags = [...allTags, data]
      onTagsListChange(newTags)
      await supabase.from('note_tag_relations').insert({ note_id: noteId, tag_id: data.id })
      onTagsChange([...noteTags, data])
    }
    setNewTagName('')
  }

  async function removeTagFromNote(tagId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('note_tag_relations').delete()
      .eq('note_id', noteId).eq('tag_id', tagId)
    onTagsChange(noteTags.filter(t => t.id !== tagId))
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 flex-wrap">
        {noteTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: tag.color + '20', color: tag.color }}
          >
            {tag.name}
            <button onClick={(e) => removeTagFromNote(tag.id, e)} className="hover:opacity-70">
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-dashed border-gray-300"
        >
          <Tag size={10} />
          Add tag
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-64">
          <p className="text-xs font-semibold text-gray-500 mb-2">Tags</p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto mb-2">
            {allTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-left text-gray-700">{tag.name}</span>
                {noteTagIds.has(tag.id) && (
                  <span className="text-xs text-blue-600 font-medium">✓</span>
                )}
              </button>
            ))}
            {allTags.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">No tags yet</p>
            )}
          </div>
          <div className="border-t border-gray-100 pt-2">
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Create tag</p>
            <div className="flex gap-1.5 mb-1.5 flex-wrap">
              {TAG_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: color,
                    borderColor: newTagColor === color ? '#1d4ed8' : 'transparent'
                  }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
                placeholder="Tag name"
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={createTag}
                className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded text-gray-400"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
