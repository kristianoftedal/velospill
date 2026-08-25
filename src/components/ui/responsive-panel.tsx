"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { createContext, useContext, type ReactNode } from "react";

/**
 * A panel for review-and-apply tasks: a right-hand sheet on desktop, a
 * bottom drawer on touch.
 *
 * Deliberately not a modal. A dialog is the wrong shape for a long scrollable
 * list the user wants to check against the page behind it — modals are for a
 * single focused decision, and stacking one over the results they describe
 * hides the very thing being verified. The sheet leaves the stage page visible;
 * the drawer gives touch users a full-width sheet they can swipe away.
 *
 * Content is unmounted while closed, so a body component mounted inside starts
 * from clean state on every open.
 */

const DesktopContext = createContext(false);

export function ResponsivePanel({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Extra classes for the desktop sheet only; the drawer is always full width. */
  className?: string;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DesktopContext.Provider value={true}>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="right"
            className={cn(
              "w-full gap-0 overflow-y-auto sm:max-w-xl lg:max-w-2xl",
              className,
            )}
          >
            {children}
          </SheetContent>
        </Sheet>
      </DesktopContext.Provider>
    );
  }

  return (
    <DesktopContext.Provider value={false}>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="gap-0">{children}</DrawerContent>
      </Drawer>
    </DesktopContext.Provider>
  );
}

export function ResponsivePanelHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const Cmp = useContext(DesktopContext) ? SheetHeader : DrawerHeader;
  return (
    <Cmp className={cn("shrink-0 border-b text-left", className)}>{children}</Cmp>
  );
}

export function ResponsivePanelTitle({ children }: { children: ReactNode }) {
  const Cmp = useContext(DesktopContext) ? SheetTitle : DrawerTitle;
  return <Cmp className="flex items-center gap-2 text-base">{children}</Cmp>;
}

export function ResponsivePanelDescription({
  children,
}: {
  children: ReactNode;
}) {
  const Cmp = useContext(DesktopContext) ? SheetDescription : DrawerDescription;
  return <Cmp>{children}</Cmp>;
}

/** Scrolls independently so the header and footer stay put. */
export function ResponsivePanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}>
      {children}
    </div>
  );
}

export function ResponsivePanelFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const Cmp = useContext(DesktopContext) ? SheetFooter : DrawerFooter;
  return (
    <Cmp
      className={cn(
        // Buttons stack full-width on touch, sit inline on desktop.
        "shrink-0 flex-col-reverse gap-2 border-t sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </Cmp>
  );
}
