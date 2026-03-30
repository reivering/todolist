'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import type { Note } from '@/types'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Quote, Highlighter, Minus, Mic, MicOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NoteEditorProps {
  note: Note
  onSave: (title: string, content: Record<string, unknown>) => void
}

export function NoteEditor({ note, onSave }: NoteEditorProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestTitle = useRef(note.title)
  const [recording, setRecording] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const shouldKeepListeningRef = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing… (supports **markdown** shortcuts)' }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
    ],
    content: note.content && Object.keys(note.content).length > 0 ? note.content : undefined,
    onUpdate: () => scheduleAutoSave(),
  })

  useEffect(() => {
    if (!editor) return
    const newContent = note.content && Object.keys(note.content).length > 0 ? note.content : undefined
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(newContent)) {
      editor.commands.setContent(newContent || '')
    }
    latestTitle.current = note.title
    if (titleRef.current) {
      titleRef.current.value = note.title === 'Untitled' ? '' : note.title
      titleRef.current.style.height = 'auto'
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  const scheduleAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (!editor) return
      onSave(latestTitle.current.trim() || 'Untitled', editor.getJSON() as Record<string, unknown>)
    }, 1000)
  }, [editor, onSave])

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    latestTitle.current = e.target.value
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
    scheduleAutoSave()
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus() }
  }

  const wordCount = editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0

  function applyPunctuation(text: string): string {
    let result = text
      .replace(/\b(comma)\b/gi, ',')
      .replace(/\b(period|full stop)\b/gi, '.')
      .replace(/\b(question mark)\b/gi, '?')
      .replace(/\b(exclamation mark|exclamation point)\b/gi, '!')
      .replace(/\b(colon)\b/gi, ':')
      .replace(/\b(semicolon|semi colon)\b/gi, ';')
      .replace(/\b(dash|hyphen)\b/gi, '\u2014')
      .replace(/\b(open quote)\b/gi, '\u201C')
      .replace(/\b(close quote|end quote)\b/gi, '\u201D')
      .replace(/\b(open paren|open parenthesis)\b/gi, '(')
      .replace(/\b(close paren|close parenthesis)\b/gi, ')')
      .replace(/\b(new line|newline)\b/gi, '\n')
      .replace(/\b(new paragraph)\b/gi, '\n\n')
    // Remove extra spaces before punctuation
    result = result.replace(/\s+([,.:;?!)\u201D])/g, '$1')
    // Capitalize after sentence-ending punctuation
    result = result.replace(/([.?!]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase())
    return result
  }

  function startListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setVoiceError('Speech recognition not supported in this browser')
      return
    }

    // Stop any existing recognition before creating a new one
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* already stopped */ }
      recognitionRef.current = null
    }

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    recognitionRef.current = rec

    rec.onstart = () => {
      setRecording(true)
      setVoiceError(null)
    }

    rec.onresult = (e: any) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript
        }
      }
      if (finalText && editor) {
        const processed = applyPunctuation(finalText)
        editor.chain().focus().insertContent(processed + ' ').run()
        scheduleAutoSave()
      }
    }

    rec.onend = () => {
      recognitionRef.current = null
      if (shouldKeepListeningRef.current) {
        setTimeout(() => {
          if (shouldKeepListeningRef.current) startListening()
        }, 500)
      } else {
        setRecording(false)
      }
    }

    rec.onerror = (e: any) => {
      const error = e.error as string
      if (error === 'aborted' || error === 'no-speech') return
      if (error === 'network') {
        setVoiceError('Cannot reach speech service — check your internet connection')
        recognitionRef.current = null
        if (shouldKeepListeningRef.current) {
          setTimeout(() => {
            if (shouldKeepListeningRef.current) startListening()
          }, 2000)
        }
        return
      }
      if (error === 'not-allowed') {
        setVoiceError('Microphone access denied — allow it in browser settings')
      } else {
        setVoiceError(`Speech error: ${error}`)
      }
      shouldKeepListeningRef.current = false
      recognitionRef.current = null
      setRecording(false)
    }

    rec.start()
    editor?.commands.focus()
  }

  async function toggleVoice() {
    if (recording) {
      shouldKeepListeningRef.current = false
      recognitionRef.current?.stop()
      setRecording(false)
      setVoiceError(null)
      return
    }

    // Request mic permission explicitly before starting recognition
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // release immediately, just needed permission
    } catch {
      setVoiceError('Microphone access denied — allow it in browser settings')
      return
    }

    setVoiceError(null)
    shouldKeepListeningRef.current = true
    startListening()
  }

  if (!editor) return null

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 sm:px-5 py-2 border-b border-slate-800 bg-slate-900/60 overflow-x-auto sm:flex-wrap relative">
        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)"><Bold size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)"><Italic size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight"><Highlighter size={13} /></ToolbarBtn>
        </ToolbarGroup>
        <Divider />
        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={13} /></ToolbarBtn>
        </ToolbarGroup>
        <Divider />
        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={13} /></ToolbarBtn>
        </ToolbarGroup>
        <Divider />
        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote"><Quote size={13} /></ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Divider"><Minus size={13} /></ToolbarBtn>
        </ToolbarGroup>

        {/* Mic button — right-aligned */}
        <div className="ml-auto flex items-center gap-1.5">
          {voiceError && (
            <span className="text-xs text-amber-400 max-w-[200px] truncate" title={voiceError}>
              {voiceError}
            </span>
          )}
          {recording && !voiceError && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Listening…
            </span>
          )}
          <button
            type="button"
            onClick={toggleVoice}
            title={recording ? 'Stop dictation' : 'Voice dictation'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              recording
                ? 'bg-red-600/30 text-red-300 hover:bg-red-600/40'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
            )}
          >
            {recording ? <MicOff size={13} /> : <Mic size={13} />}
            {recording ? 'Stop' : 'Dictate'}
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 sm:px-10 sm:py-8">
          <textarea
            ref={titleRef}
            defaultValue={note.title === 'Untitled' ? '' : note.title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            placeholder="Untitled"
            rows={1}
            className="w-full text-2xl sm:text-[2rem] font-bold text-slate-100 resize-none outline-none placeholder:text-slate-600 mb-4 sm:mb-5 bg-transparent overflow-hidden leading-tight"
          />
          <EditorContent editor={editor} className="min-h-[200px]" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 sm:px-10 py-2 border-t border-slate-800 bg-slate-900/50">
        <span className="text-xs text-slate-500">
          {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : 'Empty'}
        </span>
        <span className="text-xs text-slate-500">Auto-saved</span>
      </div>
    </div>
  )
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Divider() {
  return <div className="w-px h-4 bg-slate-700 mx-1.5" />
}

function ToolbarBtn({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active: boolean; title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-violet-600/30 text-violet-300'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}
