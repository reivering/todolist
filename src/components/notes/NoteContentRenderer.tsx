'use client'

import { cn } from '@/lib/utils'

type Mark = { type: string; attrs?: Record<string, unknown> }
type Node = {
  type: string
  text?: string
  marks?: Mark[]
  attrs?: Record<string, unknown>
  content?: Node[]
}

function renderMarks(text: string, marks: Mark[] = []): React.ReactNode {
  let node: React.ReactNode = text
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':      node = <strong>{node}</strong>; break
      case 'italic':    node = <em>{node}</em>; break
      case 'underline': node = <u>{node}</u>; break
      case 'strike':    node = <s>{node}</s>; break
      case 'code':      node = <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{node}</code>; break
      case 'highlight': node = <mark className="bg-yellow-200">{node}</mark>; break
    }
  }
  return node
}

function renderNode(node: Node, key: number): React.ReactNode {
  switch (node.type) {
    case 'text':
      return <span key={key}>{renderMarks(node.text ?? '', node.marks)}</span>

    case 'hardBreak':
      return <br key={key} />

    case 'paragraph':
      return (
        <p key={key} className="mb-3 leading-relaxed text-gray-700 empty:min-h-[1.5em]">
          {node.content?.map((n, i) => renderNode(n, i))}
        </p>
      )

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements
      const sizes: Record<number, string> = { 1: 'text-2xl font-bold mt-6 mb-2', 2: 'text-xl font-bold mt-5 mb-2', 3: 'text-lg font-semibold mt-4 mb-1.5', 4: 'text-base font-semibold mt-3 mb-1', 5: 'text-sm font-semibold mt-2 mb-1', 6: 'text-sm font-medium mt-2 mb-1' }
      return (
        <Tag key={key} className={cn('text-gray-900', sizes[level] ?? sizes[1])}>
          {node.content?.map((n, i) => renderNode(n, i))}
        </Tag>
      )
    }

    case 'bulletList':
      return (
        <ul key={key} className="list-disc list-inside mb-3 space-y-1 text-gray-700">
          {node.content?.map((n, i) => renderNode(n, i))}
        </ul>
      )

    case 'orderedList':
      return (
        <ol key={key} className="list-decimal list-inside mb-3 space-y-1 text-gray-700">
          {node.content?.map((n, i) => renderNode(n, i))}
        </ol>
      )

    case 'listItem':
      return (
        <li key={key} className="ml-2">
          {node.content?.map((n, i) => renderNode(n, i))}
        </li>
      )

    case 'blockquote':
      return (
        <blockquote key={key} className="border-l-4 border-violet-300 pl-4 my-3 italic text-gray-500">
          {node.content?.map((n, i) => renderNode(n, i))}
        </blockquote>
      )

    case 'codeBlock':
      return (
        <pre key={key} className="bg-gray-900 text-gray-100 rounded-xl p-4 mb-3 text-sm font-mono overflow-x-auto">
          <code>{node.content?.map((n, i) => renderNode(n, i))}</code>
        </pre>
      )

    case 'horizontalRule':
      return <hr key={key} className="my-4 border-gray-200" />

    case 'taskList':
      return (
        <ul key={key} className="mb-3 space-y-1">
          {node.content?.map((n, i) => renderNode(n, i))}
        </ul>
      )

    case 'taskItem':
      return (
        <li key={key} className="flex items-start gap-2 text-gray-700">
          <span className={cn('mt-1 w-3.5 h-3.5 rounded border flex-shrink-0', node.attrs?.checked ? 'bg-violet-500 border-violet-500' : 'border-gray-400')} />
          <span className={cn((node.attrs?.checked as boolean) && 'line-through text-gray-400')}>
            {node.content?.map((n, i) => renderNode(n, i))}
          </span>
        </li>
      )

    default:
      return <span key={key}>{node.content?.map((n, i) => renderNode(n, i))}</span>
  }
}

interface NoteContentRendererProps {
  content: Record<string, unknown> | null
  className?: string
}

export function NoteContentRenderer({ content, className }: NoteContentRendererProps) {
  if (!content) return <p className="text-sm text-gray-400 italic">No content</p>

  const doc = content as { content?: Node[] }
  const blocks = doc.content ?? []

  if (blocks.length === 0) return <p className="text-sm text-gray-400 italic">No content</p>

  return (
    <div className={cn('text-sm', className)}>
      {blocks.map((node, i) => renderNode(node, i))}
    </div>
  )
}
