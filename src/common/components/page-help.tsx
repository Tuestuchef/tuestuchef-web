"use client"

import { CircleHelpIcon } from "lucide-react"

import SideDrawerContent from "@/common/components/side-drawer"
import { Button } from "@/common/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/common/components/ui/drawer"
import { HELP_TOPICS, type HelpTopicKey } from "@/common/lib/constants/help.constants"

// Botón "?" junto al título: explica para qué sirve la pantalla y qué se puede hacer en ella.
const PageHelp = ({ topic }: { topic: HelpTopicKey }) => {
  const help = HELP_TOPICS[topic]

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Ayuda: ${help.title}`}>
          <CircleHelpIcon className="size-5" aria-hidden />
        </Button>
      </DrawerTrigger>
      <SideDrawerContent>
        <DrawerHeader>
          <DrawerTitle>{help.title}</DrawerTitle>
          <DrawerDescription>{help.summary}</DrawerDescription>
        </DrawerHeader>
        <div className="grid flex-1 content-start gap-3 overflow-y-auto px-4">
          {help.sections.map((section) => (
            <section key={section.heading} className="grid gap-2 rounded-xl border p-3">
              <h3 className="text-sm font-medium">{section.heading}</h3>
              <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button className="h-11 md:h-9">Entendido</Button>
          </DrawerClose>
        </DrawerFooter>
      </SideDrawerContent>
    </Drawer>
  )
}

export default PageHelp
