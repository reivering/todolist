'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Folder, Project, NoteTag } from '@/types'
import { cn } from '@/lib/utils'
import {
  CheckSquare, Search, ChevronRight, ChevronDown,
  Plus, Trash2, LogOut, PanelLeftClose, PanelLeft,
  Hash, Sparkles, FileText, Layers, FilePlus, FolderPlus, BookMarked
} from 'lucide-react'
import toast from 'react-hot-toast'
import { InputModal } from '@/components/ui/InputModal'

interface AppSidebarProps {
  userId: string
}

export function AppSidebar({ userId }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [folders, setFolders] = useState<Folder[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tags, setTags] = useState<NoteTag[]>([])
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)

  async function dropNoteOnFolder(e: React.DragEvent, folderId: string | null) {
    e.preventDefault()
    const noteId = e.dataTransfer.getData('noteId')
    if (!noteId) return
    await supabase.from('notes').update({ folder_id: folderId }).eq('id', noteId)
    setDragOverFolder(null)
    window.dispatchEvent(new CustomEvent('note-folder-changed', { detail: { noteId, folderId } }))
    import('react-hot-toast').then(({ default: toast }) => {
      const folderName = folderId ? folders.find(f => f.id === folderId)?.name : null
      toast.success(folderName ? `Moved to ${folderName}` : 'Removed from folder')
    })
  }
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [notesExpanded, setNotesExpanded] = useState(true)
  const [todosExpanded, setTodosExpanded] = useState(true)
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renamingProject, setRenamingProject] = useState<string | null>(null)
  const [modal, setModal] = useState<{
    open: boolean; title: string; placeholder: string; defaultValue: string;
    onConfirm: (v: string) => void
  }>({ open: false, title: '', placeholder: '', defaultValue: '', onConfirm: () => {} })

  function openModal(title: string, placeholder: string, defaultValue: string, onConfirm: (v: string) => void) {
    setModal({ open: true, title, placeholder, defaultValue, onConfirm })
  }
  function closeModal() { setModal(m => ({ ...m, open: false })) }

  const loadData = useCallback(async () => {
    const [foldersRes, projectsRes, tagsRes] = await Promise.all([
      supabase.from('folders').select('*').order('sort_order').order('name'),
      supabase.from('projects').select('*').order('sort_order').order('name'),
      supabase.from('note_tags').select('*').order('name'),
    ])
    if (foldersRes.data) setFolders(foldersRes.data)
    if (projectsRes.data) setProjects(projectsRes.data)
    if (tagsRes.data) setTags(tagsRes.data)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Detect mobile and auto-collapse sidebar on navigation
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-collapse sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile && !collapsed) setCollapsed(true)
  }, [pathname, isMobile, collapsed])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function createFolder(parentId?: string) {
    openModal('New folder', 'Folder name…', '', async (name) => {
      const { error } = await supabase.from('folders').insert({ user_id: userId, name, parent_id: parentId || null })
      if (error) toast.error('Failed to create folder')
      else { toast.success('Folder created'); loadData() }
      closeModal()
    })
  }

  async function renameFolder(id: string, newName: string) {
    if (!newName.trim()) { setRenamingFolder(null); return }
    await supabase.from('folders').update({ name: newName.trim() }).eq('id', id)
    setRenamingFolder(null)
    loadData()
  }

  function createProject() {
    openModal('New project', 'Project name…', '', async (name) => {
      const { error } = await supabase.from('projects').insert({ user_id: userId, name })
      if (error) toast.error('Failed to create project')
      else { toast.success('Project created'); loadData() }
      closeModal()
    })
  }

  async function renameProject(id: string, newName: string) {
    if (!newName.trim()) { setRenamingProject(null); return }
    await supabase.from('projects').update({ name: newName.trim() }).eq('id', id)
    setRenamingProject(null)
    loadData()
  }

  async function createSideNote(folderId: string | null = null) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('notes').insert({
      user_id: user.id,
      title: 'Untitled',
      folder_id: folderId,
    }).select().single()
    if (error) { toast.error('Failed to create note'); return }
    if (data) {
      toast.success('Note created')
      router.push(`/notes${folderId ? `?folder=${folderId}` : ''}`)
    }
  }

  async function deleteFolder(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Delete this folder?')) return
    await supabase.from('folders').delete().eq('id', id)
    toast.success('Folder deleted'); loadData()
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    toast.success('Project deleted'); loadData()
  }

  function toggleFolder(id: string) {
    setExpandedFolders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  const topFolders = folders.filter(f => !f.parent_id)
  const isTrashActive = pathname.startsWith('/trash')

  // Collapsed sidebar
  if (collapsed) {
    return (
      <>
      <InputModal
        open={modal.open}
        title={modal.title}
        placeholder={modal.placeholder}
        defaultValue={modal.defaultValue}
        onConfirm={modal.onConfirm}
        onCancel={closeModal}
      />
      <div className="w-16 sm:w-[52px] border-r border-slate-800 flex flex-col items-center pt-3 pb-4 gap-1 bg-slate-900">
        <button onClick={() => setCollapsed(false)} className="p-3 sm:p-2 hover:bg-slate-800 rounded-lg text-slate-500 mb-2 active:scale-95 transition-transform">
          <PanelLeft size={18} className="sm:w-4" />
        </button>
        <Link href="/notes" title="Notes" className={cn('p-3 sm:p-2 rounded-lg active:scale-95 transition-transform', pathname.startsWith('/notes') ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-800')}>
          <FileText size={19} className="sm:w-[17px]" />
        </Link>
        <Link href="/todos" title="Todos" className={cn('p-3 sm:p-2 rounded-lg active:scale-95 transition-transform', pathname.startsWith('/todos') ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-800')}>
          <CheckSquare size={19} className="sm:w-[17px]" />
        </Link>
        <Link href="/flashcards" title="Flashcards" className={cn('p-3 sm:p-2 rounded-lg active:scale-95 transition-transform', pathname.startsWith('/flashcards') ? 'bg-violet-100 text-violet-600' : 'text-slate-500 hover:bg-slate-800')}>
          <Layers size={18} className="sm:w-4" />
        </Link>
        <Link href="/briefings" title="Briefings" className={cn('p-3 sm:p-2 rounded-lg active:scale-95 transition-transform', pathname.startsWith('/briefings') ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-800')}>
          <BookMarked size={18} className="sm:w-4" />
        </Link>
        <Link href="/trash" title="Trash" className={cn('p-3 sm:p-2 rounded-lg mt-1 active:scale-95 transition-transform', isTrashActive ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:bg-slate-800')}>
          <Trash2 size={18} className="sm:w-4" />
        </Link>
        <div className="mt-auto">
          <button onClick={handleLogout} title="Sign out" className="p-3 sm:p-2 hover:bg-slate-800 rounded-lg text-slate-600 hover:text-slate-400 active:scale-95 transition-transform">
            <LogOut size={18} className="sm:w-[15px]" />
          </button>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
    <InputModal
      open={modal.open}
      title={modal.title}
      placeholder={modal.placeholder}
      defaultValue={modal.defaultValue}
      onConfirm={modal.onConfirm}
      onCancel={closeModal}
    />
    <div className="w-60 border-r border-slate-800 flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* Branding */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-100 tracking-tight">Workspace</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 active:scale-95 transition-transform">
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <form onSubmit={handleSearch}>
          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-lg px-2.5 py-1.5 focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-transparent">
            <Search size={13} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none text-slate-200 placeholder:text-slate-500 min-w-0"
            />
            <kbd className="hidden sm:block text-[10px] text-slate-600 font-mono">⌘K</kbd>
          </div>
        </form>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">

        {/* ── NOTES ── */}
        <SectionHeader
          label="Notes"
          expanded={notesExpanded}
          onToggle={() => setNotesExpanded(!notesExpanded)}
          actions={
            <>
              <button onClick={() => createSideNote()} title="New note" className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300">
                <FilePlus size={13} />
              </button>
              <button onClick={() => createFolder()} title="New folder" className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300">
                <FolderPlus size={13} />
              </button>
            </>
          }
        />

        {notesExpanded && (
          <>
            {/* "All Notes" — drop here to remove from folder */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOverFolder('__root__') }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => dropNoteOnFolder(e, null)}
              className={cn('rounded-lg transition-colors', dragOverFolder === '__root__' && 'bg-violet-100 ring-2 ring-violet-300')}
            >
              <NavLink
                href="/notes"
                active={pathname === '/notes' && !new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').has('folder')}
                icon={<NoteIcon16 />}
                label="All Notes"
              />
            </div>

            {topFolders.map(folder => (
              <FolderRow
                key={folder.id}
                folder={folder}
                allFolders={folders}
                expanded={expandedFolders.has(folder.id)}
                onToggle={() => toggleFolder(folder.id)}
                onDelete={deleteFolder}
                onCreateSub={(id) => createFolder(id)}
                onCreateNote={(id) => createSideNote(id)}
                onRename={(id) => setRenamingFolder(id)}
                renaming={renamingFolder === folder.id}
                onRenameSubmit={renameFolder}
                pathname={pathname}
                dragOver={dragOverFolder === folder.id}
                onDragOver={() => setDragOverFolder(folder.id)}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => dropNoteOnFolder(e, folder.id)}
              />
            ))}

            {tags.map(tag => (
              <NavLink
                key={tag.id}
                href={`/notes?tag=${tag.id}`}
                active={false}
                icon={<Hash size={13} />}
                iconColor={tag.color}
                label={tag.name}
              />
            ))}
          </>
        )}

        <div className="pt-1" />

        {/* ── TODOS ── */}
        <SectionHeader
          label="Todos"
          expanded={todosExpanded}
          onToggle={() => setTodosExpanded(!todosExpanded)}
          actions={
            <button onClick={createProject} title="New project" className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300">
              <FolderPlus size={13} />
            </button>
          }
        />

        {todosExpanded && (
          <>
            <NavLink
              href="/todos"
              active={pathname === '/todos' && !new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').has('project')}
              icon={<CheckSquare size={14} />}
              iconBg="bg-violet-100 text-violet-600"
              label="All Todos"
            />

            {projects.map(project => (
              <ProjectRow
                key={project.id}
                project={project}
                onDelete={deleteProject}
                onRename={() => setRenamingProject(project.id)}
                renaming={renamingProject === project.id}
                onRenameSubmit={renameProject}
                pathname={pathname}
              />
            ))}
          </>
        )}

        <div className="pt-2 border-t border-slate-800 mt-2">
          <NavLink
            href="/flashcards"
            active={pathname.startsWith('/flashcards')}
            icon={<Layers size={14} />}
            iconBg="bg-violet-100 text-violet-600"
            label="Flashcards"
          />
          <NavLink
            href="/briefings"
            active={pathname.startsWith('/briefings')}
            icon={<BookMarked size={14} />}
            iconBg="bg-indigo-100 text-indigo-600"
            label="Briefings"
          />
          <NavLink
            href="/trash"
            active={isTrashActive}
            icon={<Trash2 size={14} />}
            iconBg="bg-slate-800 text-slate-400"
            label="Trash"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 p-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 rounded-lg"
        >
          <LogOut size={14} className="text-slate-500" />
          Sign out
        </button>
      </div>
    </div>
    </>
  )
}

/* ── Sub-components ── */

function SectionHeader({ label, expanded, onToggle, actions }: {
  label: string; expanded: boolean; onToggle: () => void; actions: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1 group">
      <button onClick={onToggle} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300">
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {label}
      </button>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
        {actions}
      </div>
    </div>
  )
}

function NavLink({ href, active, icon, iconBg, iconColor, label }: {
  href: string; active: boolean; icon: React.ReactNode; iconBg?: string; iconColor?: string; label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm',
        active ? 'bg-slate-800 text-slate-100 font-medium' : 'text-slate-300 hover:bg-slate-900/50 hover:text-slate-100'
      )}
    >
      <span
        className={cn('flex items-center justify-center flex-shrink-0', !iconBg && !iconColor && 'w-5 h-5', iconBg && 'w-5 h-5 rounded-md')}
        style={iconColor ? { color: iconColor, backgroundColor: iconColor + '18', width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

function FolderRow({ folder, allFolders, expanded, onToggle, onDelete, onCreateSub, onCreateNote, onRename, renaming, onRenameSubmit, pathname, dragOver, onDragOver, onDragLeave, onDrop }: {
  folder: Folder; allFolders: Folder[]; expanded: boolean; onToggle: () => void
  onDelete: (id: string, e: React.MouseEvent) => void; onCreateSub: (id: string) => void; onCreateNote: (id: string) => void
  onRename: (id: string) => void; renaming: boolean; onRenameSubmit: (id: string, name: string) => void; pathname: string
  dragOver?: boolean; onDragOver?: () => void; onDragLeave?: () => void; onDrop?: (e: React.DragEvent) => void
}) {
  const children = allFolders.filter(f => f.parent_id === folder.id)
  const isActive = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('folder') === folder.id

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); onDragOver?.() }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors',
          dragOver ? 'bg-amber-100 ring-2 ring-amber-300' : isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-900/50 hover:text-slate-100'
        )}
      >
        <button onClick={onToggle} className="flex-shrink-0 text-slate-500 hover:text-slate-300 w-4">
          {children.length > 0
            ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : null}
        </button>
        <FolderIcon16 open={expanded} />
        {renaming ? (
          <input
            autoFocus
            defaultValue={folder.name}
            onBlur={(e) => onRenameSubmit(folder.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(folder.id, e.currentTarget.value); if (e.key === 'Escape') onRenameSubmit(folder.id, folder.name) }}
            className="flex-1 text-sm outline-none bg-transparent border-b border-blue-400 min-w-0"
            onClick={(e) => e.preventDefault()}
          />
        ) : (
          <Link href={`/notes?folder=${folder.id}`} className="flex-1 text-sm truncate min-w-0" onDoubleClick={() => onRename(folder.id)}>
            {folder.name}
          </Link>
        )}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onCreateNote(folder.id)} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300" title="New file">
            <FilePlus size={12} strokeWidth={2} />
          </button>
          <button onClick={() => onCreateSub(folder.id)} className="p-0.5 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300" title="New folder">
            <FolderPlus size={12} strokeWidth={2} />
          </button>
          <button onClick={(e) => onDelete(folder.id, e)} className="p-0.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-500" title="Delete">
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {children.map(child => (
            <FolderRow key={child.id} folder={child} allFolders={allFolders} expanded={false} onToggle={() => {}}
              onDelete={onDelete} onCreateSub={onCreateSub} onCreateNote={onCreateNote} onRename={onRename}
              renaming={false} onRenameSubmit={onRenameSubmit} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectRow({ project, onDelete, onRename, renaming, onRenameSubmit, pathname }: {
  project: Project; onDelete: (id: string, e: React.MouseEvent) => void
  onRename: () => void; renaming: boolean; onRenameSubmit: (id: string, name: string) => void; pathname: string
}) {
  const isActive = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('project') === project.id

  return (
    <div className={cn('group flex items-center gap-2 px-2 py-1.5 rounded-lg', isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-900/50 hover:text-slate-100')}>
      <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
        {project.name.charAt(0).toUpperCase()}
      </span>
      {renaming ? (
        <input autoFocus defaultValue={project.name}
          onBlur={(e) => onRenameSubmit(project.id, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(project.id, e.currentTarget.value); if (e.key === 'Escape') onRenameSubmit(project.id, project.name) }}
          className="flex-1 text-sm outline-none bg-transparent border-b border-blue-400 min-w-0"
        />
      ) : (
        <Link href={`/todos?project=${project.id}`} className="flex-1 text-sm truncate min-w-0" onDoubleClick={onRename}>
          {project.name}
        </Link>
      )}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
        <button onClick={(e) => onDelete(project.id, e)} className="p-0.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-500">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

/* ── Custom Icons ── */

function NoteIcon16() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Page body */}
      <rect x="2.5" y="1.5" width="11" height="14" rx="1.5" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1" />
      {/* Dog-ear fold */}
      <path d="M10.5 1.5 L13.5 4.5 L10.5 4.5 Z" fill="#c4b5fd" stroke="#7c3aed" strokeWidth="1" strokeLinejoin="round" />
      {/* Lines */}
      <line x1="5" y1="7.5" x2="11" y2="7.5" stroke="#7c3aed" strokeWidth="1" strokeLinecap="round" />
      <line x1="5" y1="10" x2="11" y2="10" stroke="#7c3aed" strokeWidth="1" strokeLinecap="round" />
      <line x1="5" y1="12.5" x2="8.5" y2="12.5" stroke="#7c3aed" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function FolderIcon16({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Back panel */}
      <rect x="1.5" y="5" width="15" height="10.5" rx="1.5" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
      {/* Tab */}
      <path d="M1.5 5 Q1.5 3.5 3 3.5 L6.5 3.5 Q7.5 3.5 8 4.5 L8.5 5 Z" fill="#fcd34d" stroke="#d97706" strokeWidth="1" strokeLinejoin="round" />
      {/* Front shadow line */}
      <line x1="1.5" y1="8" x2="16.5" y2="8" stroke="#f59e0b" strokeWidth="0.75" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Body */}
      <rect x="1.5" y="5" width="15" height="10.5" rx="1.5" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
      {/* Tab */}
      <path d="M1.5 5 Q1.5 3.5 3 3.5 L6.5 3.5 Q7.5 3.5 8 4.5 L8.5 5 Z" fill="#fde68a" stroke="#d97706" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
