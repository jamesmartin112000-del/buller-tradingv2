import React from 'react';
import { Box, Group, Text, ThemeIcon } from '@mantine/core';
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  LayersIcon,
  MinusIcon } from
'lucide-react';
import type { GoldConfirmationStep } from '../../lib/engine/goldMarketBias';
export function GoldConfirmationStepCard({
  step


}: {step: GoldConfirmationStep;}) {
  const Icon =
  step.state === 'pass' ?
  CheckCircle2Icon :
  step.state === 'wait' ?
  CircleDashedIcon :
  MinusIcon;
  const color =
  step.state === 'pass' ?
  '#00ff88' :
  step.state === 'wait' ?
  '#ffd43b' :
  '#777';
  return (
    <Box className={`rounded-md border p-3 ${stepPanelClass(step.state)}`}>
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <ThemeIcon
          size="sm"
          radius="xl"
          variant="light"
          color={
          step.state === 'pass' ?
          'green' :
          step.state === 'wait' ?
          'yellow' :
          'gray'
          }
          aria-hidden="true">
          
          <Text size="xs" fw={900}>
            {step.number}
          </Text>
        </ThemeIcon>
        <Box className="min-w-0 flex-1">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="xs" fw={900} tt="uppercase">
              {step.title}
            </Text>
            <Group gap={4} wrap="nowrap">
              <Icon size={13} color={color} aria-hidden="true" />
              <Text size="xs" fw={900} c={color}>
                {step.state.toUpperCase()}
              </Text>
            </Group>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {step.detail}
          </Text>
        </Box>
      </Group>
    </Box>);

}
export function GoldTradeMetric({
  label,
  value,
  tone




}: {label: string;value: string;tone?: 'buy' | 'sell' | 'warn';}) {
  const color =
  tone === 'buy' ?
  '#00ff88' :
  tone === 'sell' ?
  '#ff4444' :
  tone === 'warn' ?
  '#ffd43b' :
  '#f5f5f5';
  return (
    <Box className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="sm" fw={900} c={color} className="font-mono" mt={2}>
        {value}
      </Text>
    </Box>);

}
export function GoldChartReference({
  label,
  value,
  detail,
  tone





}: {label: string;value: string;detail: string;tone: 'green' | 'red' | 'yellow' | 'gray';}) {
  const color =
  tone === 'green' ?
  '#00ff88' :
  tone === 'red' ?
  '#ff4444' :
  tone === 'yellow' ?
  '#ffd43b' :
  '#aaa';
  return (
    <Box className="rounded-md border border-white/10 bg-white/[0.025] px-3 py-2">
      <Group gap={6} wrap="nowrap">
        <LayersIcon size={13} color={color} aria-hidden="true" />
        <Text size="xs" c="dimmed" tt="uppercase" fw={800}>
          {label}
        </Text>
      </Group>
      <Text size="sm" fw={900} c={color} className="font-mono" mt={4}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" mt={2}>
        {detail}
      </Text>
    </Box>);

}
function stepPanelClass(state: GoldConfirmationStep['state']): string {
  if (state === 'pass') return 'border-[#00ff88]/20 bg-[#00ff88]/5';
  if (state === 'wait') return 'border-yellow-400/20 bg-yellow-400/5';
  return 'border-white/10 bg-white/[0.02]';
}