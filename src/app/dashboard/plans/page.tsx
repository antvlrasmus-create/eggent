import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { PlansSection } from "@/components/plans-section"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export const dynamic = "force-dynamic"

export default async function PlansPage() {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader title="Multi-Agent Plans" />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col h-[calc(100svh-var(--header-height))] overflow-y-auto p-6">
               <div className="max-w-4xl mx-auto w-full">
                  <PlansSection />
               </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
