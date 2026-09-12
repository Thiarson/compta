'use client';

import * as React from 'react';

import { AccountSwitcher } from '@/components/account-switcher';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { isSameDay } from '@/lib/utils';
import { LayoutDashboardIcon } from 'lucide-react';

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: <LayoutDashboardIcon />,
      isActive: true,
    },
  ],
};

export function AppSidebar({
  selectedDate,
  onSelectDate,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <AccountSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          {!isSameDay(selectedDate, today) && (
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="xs" onClick={() => onSelectDate(today)}>
                Today
              </Button>
            </div>
          )}
          <SidebarGroupContent>
            <Calendar
              mode="single"
              required
              captionLayout="dropdown"
              selected={selectedDate}
              onSelect={onSelectDate}
              className="w-full p-0"
            />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
