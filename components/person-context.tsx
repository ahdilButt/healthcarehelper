'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { newCapture, people, timeline, type Person, type TimelineItem } from '@/lib/mock'

type Stories = Record<string, TimelineItem[]>

type Ctx = {
  person: Person
  setPersonId: (id: string) => void
  items: TimelineItem[]
  addCapture: () => void
}

const initialStories: Stories = { dad: timeline, you: [] }

const PersonContext = createContext<Ctx>({
  person: people[0],
  setPersonId: () => {},
  items: timeline,
  addCapture: () => {},
})

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(people[0].id)
  const [stories, setStories] = useState<Stories>(initialStories)

  const person = people.find((p) => p.id === id) ?? people[0]

  const addCapture = useCallback(() => {
    setStories((current) => ({
      ...current,
      [person.id]: [newCapture(person.id === 'dad' ? "Dad's story" : 'your story'), ...(current[person.id] ?? [])],
    }))
  }, [person.id])

  const value = useMemo<Ctx>(
    () => ({ person, setPersonId: setId, items: stories[person.id] ?? [], addCapture }),
    [person, stories, addCapture],
  )

  return <PersonContext.Provider value={value}>{children}</PersonContext.Provider>
}

export function usePerson() {
  return useContext(PersonContext)
}
