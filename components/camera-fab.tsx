'use client'

import { useState } from 'react'
import { Camera, FileText, Plus } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { PillButton } from '@/components/ui-bits'

export function CameraFab() {
  const [open, setOpen] = useState(false)
  const [captured, setCaptured] = useState(false)

  function capture() {
    setOpen(false)
    setCaptured(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => setCaptured(false), 3200)
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[720px]">
        <p
          aria-live="polite"
          className={`mx-5 mb-3 rounded-full bg-foreground px-4 py-2.5 text-center text-[14px] font-medium text-background transition-opacity duration-300 ${
            captured ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Photo added — reading it now
        </p>
        <div className="flex justify-end px-5 pb-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(232,106,51,0.35)] active:bg-primary/90"
          >
            <Plus className="size-7" />
            <span className="sr-only">Add a letter</span>
          </button>
        </div>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add something to Dad's story">
        <p className="text-[15px] text-muted-foreground">
          Photograph a letter, a results slip or a pharmacy label. We&apos;ll read it and add what it
          says to the story.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <PillButton onClick={capture}>
            <Camera className="size-5" />
            Take a photo
          </PillButton>
          <PillButton variant="plain" onClick={capture}>
            <FileText className="size-5" />
            Choose from your photos
          </PillButton>
        </div>
        <p className="mt-5 text-[13px] text-muted-foreground">
          Lay the letter flat and get all four corners in the picture.
        </p>
      </BottomSheet>
    </>
  )
}
