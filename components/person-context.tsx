'use client'

import { createContext, useContext, useState } from 'react'
import { people, type Person } from '@/lib/mock'

type Ctx = { person: Person; setPersonId: (id: string) => void }

const PersonContext = createContext<Ctx>({ person: people[0], setPersonId: () => {} })

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState(people[0].id)
  const person = people.find((p) => p.id === id) ?? people[0]
  return (
    <PersonContext.Provider value={{ person, setPersonId: setId }}>{children}</PersonContext.Provider>
  )
}

export function usePerson() {
  return useContext(PersonContext)
}
