import { useEffect, useState } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { LocateFixedIcon } from 'lucide-react';
import { DASHBOARD_SECTIONS } from '../../data/dashboardSections';
export function DashboardSectionNav() {
  const [activeId, setActiveId] = useState(DASHBOARD_SECTIONS[0].id);
  const activeSection = DASHBOARD_SECTIONS.find((section) => section.id === activeId) ?? DASHBOARD_SECTIONS[0];
  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>('[data-app-scroll-container]');
    const elements = DASHBOARD_SECTIONS.map((section) => document.getElementById(section.id)).filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((first, second) => Math.abs(first.boundingClientRect.top) - Math.abs(second.boundingClientRect.top));
      if (visible[0]) setActiveId(visible[0].target.id);
    }, {
      root: scrollRoot,
      rootMargin: '-12% 0px -68% 0px',
      threshold: [0, 0.05, 0.2]
    });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  const jumpToSection = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };
  return <Box component="nav" aria-label="BULLER dashboard model sections" className="sticky top-0 z-20 -mx-1">
      <Box className="rounded-md border border-brand/40 bg-bg-800/95 p-2 shadow-xl backdrop-blur-md sm:p-2.5">
        <Group justify="space-between" gap="xs" wrap="nowrap" mb={7}>
          <Group gap={7} wrap="nowrap" className="min-w-0">
            <Box className="grid h-7 w-7 shrink-0 place-items-center rounded border border-brand/35 bg-brand/10">
              <div size={14} className="text-brand" aria-hidden="true" />
            </Box>
            <Box className="min-w-0">
              <Text size="10px" fw={900} tt="uppercase" lts="0.14em" c="#e2bf76">
                BULLER Model Set
              </Text>
              <Text size="9px" c="dimmed" className="hidden sm:block">
                Jump directly to any analysis module
              </Text>
            </Box>
          </Group>
          <Group gap={4} wrap="nowrap">
            <LocateFixedIcon size={12} className="text-ink-dim" aria-hidden="true" />
            <Text size="9px" c="dimmed" className="numeric-value font-mono">
              {activeSection.code} / B9
            </Text>
          </Group>
        </Group>

        <div className="grid grid-cols-5 gap-1 lg:grid-cols-9">
          {DASHBOARD_SECTIONS.map((section) => {
          const active = section.id === activeId;
          return <button key={section.id} type="button" onClick={() => jumpToSection(section.id)} aria-label={`Go to ${section.code}: ${section.label}`} aria-current={active ? 'location' : undefined} title={section.label} className={`min-w-0 rounded border px-1.5 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 lg:px-2 ${active ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-bg-700 text-ink-muted hover:border-brand/40 hover:bg-bg-600 hover:text-ink'}`}>
                <span className="block font-mono text-[10px] font-extrabold leading-none">
                  {section.code}
                </span>
                <span className="mt-1 hidden truncate text-[8px] font-semibold leading-none lg:block">
                  {section.shortLabel}
                </span>
              </button>;
        })}
        </div>

        <Text size="9px" fw={700} c="#f3f1e9" ta="center" mt={6} className="truncate lg:hidden" aria-live="polite">
          {activeSection.code} · {activeSection.label}
        </Text>
      </Box>
    </Box>;
}