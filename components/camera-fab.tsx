'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera, Check, FileText, Plus, RefreshCw, X, Zap } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { usePerson } from '@/components/person-context'
import { Meta, PillButton } from '@/components/ui-bits'
import { photoLibrary } from '@/lib/mock'

type Step = 'closed' | 'choose' | 'camera' | 'library' | 'review'

export function CameraFab() {
  const { person, addCapture } = usePerson()
  const [step, setStep] = useState<Step>('closed')
  const [shot, setShot] = useState(photoLibrary[0])
  const [added, setAdded] = useState(false)

  const storyName = person.id === 'dad' ? "Dad's story" : 'your story'

  function close() {
    setStep('closed')
  }

  function shutter() {
    setShot(photoLibrary[0])
    setStep('review')
  }

  function pick(item: (typeof photoLibrary)[number]) {
    setShot(item)
    setStep('review')
  }

  function use() {
    addCapture()
    setStep('closed')
    setAdded(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => setAdded(false), 3200)
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[720px]">
        <p
          aria-live="polite"
          className={`mx-5 mb-3 rounded-full bg-foreground px-4 py-2.5 text-center text-[14px] font-medium text-background transition-opacity duration-300 ${
            added ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Photo added — reading it now
        </p>
        <div className="flex justify-end px-5 pb-[calc(4.75rem+max(0.5rem,env(safe-area-inset-bottom)))]">
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(232,106,51,0.35)] active:bg-primary/90"
          >
            <Plus className="size-7" />
            <span className="sr-only">Add to {storyName}</span>
          </button>
        </div>
      </div>

      <BottomSheet
        open={step === 'choose'}
        onClose={close}
        title={`Add something to ${storyName}`}
      >
        <p className="text-[15px] text-muted-foreground">
          Photograph a letter, a results slip or a pharmacy label. We&apos;ll read it and add what it
          says to the story.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <PillButton onClick={() => setStep('camera')}>
            <Camera className="size-5" />
            Take a photo
          </PillButton>
          <PillButton variant="plain" onClick={() => setStep('library')}>
            <FileText className="size-5" />
            Choose from your photos
          </PillButton>
        </div>
        <p className="mt-5 text-[13px] text-muted-foreground">
          Lay the letter flat and get all four corners in the picture.
        </p>
      </BottomSheet>

      <BottomSheet open={step === 'library'} onClose={close} title="Choose a photo">
        <Meta>Your most recent pictures</Meta>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photoLibrary.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className="overflow-hidden rounded-md border border-border text-left active:opacity-80"
            >
              <Image
                src={item.src}
                alt={item.label}
                width={200}
                height={200}
                className="aspect-square w-full object-cover"
              />
              <span className="block px-2 py-1.5">
                <span className="block truncate text-[13px] font-medium">{item.label}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{item.when}</span>
              </span>
            </button>
          ))}
        </div>
        <PillButton variant="plain" className="mt-4 w-full" onClick={() => setStep('choose')}>
          Back
        </PillButton>
      </BottomSheet>

      {step === 'camera' ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-foreground text-background">
          <div className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={close}
              className="flex size-10 items-center justify-center rounded-full bg-background/15"
            >
              <X className="size-5" />
              <span className="sr-only">Close the camera</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Zap className="size-4" aria-hidden="true" />
              Flash auto
            </span>
          </div>

          <div className="relative mx-5 mt-4 flex-1 overflow-hidden rounded-lg">
            <Image
              src={photoLibrary[0].src}
              alt="Camera view of the letter on the table"
              fill
              className="scale-[1.06] object-cover"
              priority
            />
            <div className="absolute inset-6" aria-hidden="true">
              <span className="absolute left-0 top-0 size-8 border-l-2 border-t-2 border-background/85" />
              <span className="absolute right-0 top-0 size-8 border-r-2 border-t-2 border-background/85" />
              <span className="absolute bottom-0 left-0 size-8 border-b-2 border-l-2 border-background/85" />
              <span className="absolute bottom-0 right-0 size-8 border-b-2 border-r-2 border-background/85" />
            </div>
            <p className="absolute inset-x-0 bottom-4 text-center text-[14px] font-medium">
              Get all four corners inside the frame
            </p>
          </div>

          <div className="flex items-center justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            <button
              type="button"
              onClick={shutter}
              className="flex size-[72px] items-center justify-center rounded-full border-4 border-background/70 active:scale-95"
            >
              <span className="size-14 rounded-full bg-background" aria-hidden="true" />
              <span className="sr-only">Take the photo</span>
            </button>
          </div>
        </div>
      ) : null}

      <BottomSheet open={step === 'review'} onClose={close} title="Happy with this photo?">
        <div className="overflow-hidden rounded-lg border border-border">
          <Image
            src={shot.src}
            alt={shot.label}
            width={720}
            height={520}
            className="max-h-[42vh] w-full object-cover"
          />
        </div>
        <Meta className="mt-2">
          Check the whole page is in the picture and the writing is readable.
        </Meta>
        <div className="mt-5 flex flex-col gap-3">
          <PillButton onClick={use}>
            <Check className="size-5" />
            Use this photo
          </PillButton>
          <PillButton
            variant="plain"
            onClick={() => setStep(shot.id === photoLibrary[0].id ? 'camera' : 'library')}
          >
            <RefreshCw className="size-4" />
            Take another
          </PillButton>
        </div>
      </BottomSheet>
    </>
  )
}
