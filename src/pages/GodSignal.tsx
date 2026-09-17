import React from 'react';
import { motion } from 'framer-motion';
import {
  CrownIcon,
  SparklesIcon,
  TargetIcon,
  ShieldCheckIcon,
  LayersIcon,
  ActivityIcon } from
'lucide-react';
import { GodSignalTerminal } from '../components/terminal/GodSignalTerminal';
/**
 * GOD SIGNAL — the platform's highest-tier, premium signal experience.
 * Only the most confluent setups (8+/10 strategies agreeing, 90%+ confidence,
 * minimum 1:3 RR, order-flow verified) qualify. The page frames the live
 * GodSignalTerminal engine in a striking gold / platinum premium shell.
 */
const PILLS = [
{
  icon: TargetIcon,
  label: '90%+ Confidence'
},
{
  icon: LayersIcon,
  label: '8 / 10 Strategies Confirm'
},
{
  icon: ShieldCheckIcon,
  label: 'Minimum 1 : 3 RR'
},
{
  icon: ActivityIcon,
  label: 'Order-Flow Verified'
}];

export default function GodSignal() {
  return (
    <div className="min-h-screen w-full bg-bg p-3 lg:p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Premium hero */}
        <motion.header
          initial={{
            opacity: 0,
            y: -12
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.4,
            ease: 'easeOut'
          }}
          className="relative overflow-hidden rounded-xl border border-gold/30 bg-bg-700">
          
          <div className="relative px-4 py-5 lg:px-7 lg:py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3.5">
                <motion.div
                  initial={{
                    scale: 0.7,
                    rotate: -8
                  }}
                  animate={{
                    scale: 1,
                    rotate: 0
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 220,
                    damping: 14
                  }}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-gold/40 bg-bg-800">
                  
                  <CrownIcon className="h-6 w-6 text-gold" />
                </motion.div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="bg-gradient-to-r from-gold via-platinum to-gold bg-clip-text text-2xl font-black uppercase tracking-[0.14em] text-transparent lg:text-3xl">
                      BULLER TRADING Signal
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.18em] text-gold">
                      <SparklesIcon className="h-3 w-3" />
                      Premium
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-2xs leading-relaxed text-ink-muted lg:text-xs">
                    The highest-conviction signal tier. Fires only when 8 of 10
                    institutional strategies align with 90%+ confidence and
                    order-flow confirmation.
                  </p>
                </div>
              </div>

              {/* feature pills */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                {PILLS.map(({ icon: Icon, label }) =>
                <div
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gold/25 bg-gold/10 px-2.5 py-1.5">
                  
                    <Icon className="h-3.5 w-3.5 shrink-0 text-gold" />
                    <span className="text-2xs font-semibold tracking-wide text-platinum">
                      {label}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.header>

        {/* Live engine, framed in a premium gold shell */}
        <motion.div
          initial={{
            opacity: 0,
            y: 12
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            duration: 0.4,
            ease: 'easeOut',
            delay: 0.1
          }}
          className="rounded-xl border border-gold/20 bg-bg-700/40 p-2 lg:p-3">
          
          <GodSignalTerminal />
        </motion.div>
      </div>
    </div>);

}