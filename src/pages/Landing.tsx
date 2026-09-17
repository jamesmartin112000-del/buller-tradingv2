import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ZapIcon,
  ShieldCheckIcon,
  BrainIcon,
  TrendingUpIcon,
  ActivityIcon,
  LayersIcon,
  TargetIcon,
  LockIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CalculatorIcon,
  GlobeIcon,
  CheckIcon,
  ExternalLinkIcon,
  LandmarkIcon,
  InfoIcon,
  MenuIcon,
  XIcon } from
'lucide-react';
import { RegisterDeviceModal } from '../components/account/RegisterDeviceModal';
import { AccessRequestModal } from '../components/access/AccessRequestModal';
import { HeroAtmosphere } from '../components/common/HeroAtmosphere';
import { Logo } from '../components/common/Logo';
import { PublicManagedLinks } from '../components/common/PublicManagedLinks';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useContent } from '../lib/db/hooks';
import { useMembershipPlans } from '../hooks/useMembershipPlans';
const EXNESS_INVITATION_URL = 'https://one.exnessonelink.com/a/cggoz0mpds';
const FEATURES = [
{
  icon: BrainIcon,
  title: 'SMC / ICT Intelligence',
  desc: 'Maps market structure, order blocks, fair-value gaps and liquidity sweeps across multiple timeframes.'
},
{
  icon: ActivityIcon,
  title: 'AMD Phase Context',
  desc: 'Evaluates accumulation, manipulation and distribution phases to frame institutional-style market behavior.'
},
{
  icon: ZapIcon,
  title: 'Multi-Indicator Signal Stack',
  desc: 'Combines 10 weighted strategies, MTF alignment, RSI, volatility, support and resistance into one decision view.'
},
{
  icon: TargetIcon,
  title: 'Precision Entry Planning',
  desc: 'Builds sniper-style entry plans with calculated entry, stop-loss, targets, risk-reward and confidence context.'
},
{
  icon: BarChart3Icon,
  title: 'Order Flow & Hidden Inputs',
  desc: 'Synthesizes buy/sell pressure, imbalance, volatility and available hidden-data inputs for deeper context.'
},
{
  icon: GlobeIcon,
  title: 'Forex, Gold & Crypto',
  desc: 'Professional market intelligence across major Forex pairs, XAU/USD, Bitcoin, Ethereum and other liquid markets.'
},
{
  icon: CalculatorIcon,
  title: 'Risk & Trade Calculators',
  desc: 'Plan lot size, position risk, risk-reward, compounding, profit and funding fees from one workspace.'
},
{
  icon: LockIcon,
  title: 'Private Professional Access',
  desc: 'A protected, invite-only workspace with account verification, license access and dedicated support.'
}];

const STATS = [
{
  v: '30+',
  l: 'Live Pairs'
},
{
  v: '10',
  l: 'Strategies'
},
{
  v: '6',
  l: 'Timeframes'
},
{
  v: 'Real',
  l: 'Market Data'
}];

export function Landing() {
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const eyebrow = useContent('landing.hero.eyebrow', 'BULLER TRADING');
  const heroSubtitle = useContent(
    'landing.hero.subtitle',
    'A professional Forex, Gold and Crypto decision-support engine that combines multi-indicator analysis, SMC, ICT, AMD, order flow and hidden-data context to build disciplined, precision-focused trade plans.'
  );
  const plans = useMembershipPlans();
  return (
    <div className="min-h-screen w-full bg-bg-900 text-ink">
      {/* NAV */}
      <header className="sticky top-0 z-30 bg-bg-900/80 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Logo size={46} className="[&_.logo-copy]:hidden sm:[&_.logo-copy]:block" />
          <nav className="hidden md:flex items-center gap-7 text-sm text-ink-muted">
            <a href="#features" className="hover:text-ink transition-colors">
              Features
            </a>
            <a href="#engine" className="hover:text-ink transition-colors">
              Engine
            </a>
            <a href="#broker" className="hover:text-ink transition-colors">
              Broker Access
            </a>
            <a href="#pricing" className="hover:text-ink transition-colors">
              Pricing
            </a>
            <a href="#access" className="hover:text-ink transition-colors">
              Access
            </a>
            <a
              href={EXNESS_INVITATION_URL}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-brand hover:text-ink transition-colors"
              aria-label="Open Exness invitation link in a new tab">
              
              Exness
              <ExternalLinkIcon className="w-3 h-3" />
            </a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="secondary" size="sm" className="hidden min-[430px]:inline-flex" onClick={() => setDemoModalOpen(true)}>
              Free Demo
            </Button>
            <Link to="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/signup" className="hidden sm:block">
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRightIcon className="w-3.5 h-3.5" />}>
                
                Sign Up
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 md:hidden">
              
              {mobileNavOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNavOpen &&
        <nav className="border-t border-line bg-bg-800 px-4 py-4 md:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 text-sm">
              {[
            ['Features', '#features'],
            ['Engine', '#engine'],
            ['Broker Access', '#broker'],
            ['Pricing', '#pricing']].
            map(([label, href]) =>
            <a
              key={href}
              href={href}
              onClick={() => setMobileNavOpen(false)}
              className="flex min-h-11 items-center rounded-md border border-line bg-bg-700 px-3 text-ink-muted transition-colors hover:border-brand/50 hover:text-brand">
              
                  {label}
                </a>
            )}
              <Button variant="secondary" size="md" className="col-span-2 w-full" onClick={() => {setMobileNavOpen(false);setDemoModalOpen(true);}}>
                Free Demo
              </Button>
              <Link to="/signup" className="col-span-2">
                <Button variant="primary" size="md" className="w-full">Request Access <ArrowRightIcon className="h-4 w-4" /></Button>
              </Link>
            </div>
          </nav>
        }
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#062b20]">
        <HeroAtmosphere />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-16 sm:pt-20 pb-20 sm:pb-28 text-center">
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.5
            }}
            className="inline-flex items-center gap-2 bg-brand/10 border border-brand/30 rounded-full px-3 py-1 mb-3">
            
            <span className="w-1.5 h-1.5 rounded-full bg-brand dot-pulse" />
            <span className="text-2xs uppercase tracking-[0.2em] text-brand font-bold">
              {eyebrow}
            </span>
          </motion.div>

          {/* Paid tool bilingual badge */}
          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.4,
              delay: 0.05
            }}
            className="inline-flex items-center gap-2 bg-warn/10 border border-warn/30 rounded-full px-3 py-1 mb-6 ml-2">
            
            <LockIcon className="w-3 h-3 text-warn" />
            <span className="text-2xs uppercase tracking-[0.18em] text-warn font-bold">
              Paid Tool · Invite-only
            </span>
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.6,
              delay: 0.1
            }}
            className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-5xl mx-auto text-balance">
            
            BULLER TRADING
            <span className="mt-2 block text-brand">
              Gold intelligence. Disciplined execution.
            </span>
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            transition={{
              duration: 0.6,
              delay: 0.25
            }}
            className="text-base lg:text-lg text-ink-muted mt-6 max-w-2xl mx-auto leading-relaxed">
            
            {heroSubtitle}
            <span className="mt-3 block text-sm text-ink-dim">
              BULLER TRADING provides professional XAUUSD market intelligence,
              precision-focused analysis and disciplined trade-planning tools.
            </span>
          </motion.p>

          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.5,
              delay: 0.4
            }}
            className="flex flex-wrap items-center justify-center gap-3 mt-10">
            
            <Button variant="primary" size="lg" icon={<ZapIcon className="w-4 h-4" />} onClick={() => setDemoModalOpen(true)}>
              Free Demo
            </Button>
            <Link to="/signup"><Button variant="secondary" size="lg">Get Access · Sign Up</Button></Link>
            <a href="#pricing">
              <Button variant="secondary" size="lg">
                See Plans
              </Button>
            </a>
          </motion.div>

          <div className="mt-12 inline-flex items-center gap-2 text-2xs text-ink-dim uppercase tracking-[0.18em]">
            <ShieldCheckIcon className="w-3.5 h-3.5 text-brand" />
            <span>Author</span>
            <span className="text-ink font-semibold tracking-wider">
              (R.D.H;~$)
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="relative max-w-5xl mx-auto px-4 lg:px-8 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATS.map((s) =>
            <div
              key={s.l}
              className="bg-bg-700/60 backdrop-blur border border-line rounded-md p-5 text-center">
              
                <div className="text-2xl lg:text-3xl font-extrabold text-brand font-mono">
                  {s.v}
                </div>
                <div className="text-2xs uppercase tracking-wider text-ink-muted mt-1">
                  {s.l}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge tone="brand" size="md">
            CORE FEATURES
          </Badge>
          <h2 className="text-3xl lg:text-5xl font-bold mt-4">
            Built for institutional precision
          </h2>
          <p className="text-ink-muted mt-3 max-w-3xl mx-auto leading-relaxed">
            A unified professional workspace that converts multiple indicators,
            institutional concepts, big-player context and market data into
            structured analysis—not hype or guaranteed outcomes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) =>
          <motion.div
            key={f.title}
            initial={{
              opacity: 0,
              y: 20
            }}
            whileInView={{
              opacity: 1,
              y: 0
            }}
            viewport={{
              once: true
            }}
            transition={{
              duration: 0.4,
              delay: i * 0.05
            }}
            className="bg-bg-600 border border-line rounded-md p-5 hover:border-brand/40 transition-colors group">
            
              <div className="w-10 h-10 rounded-md bg-brand/10 border border-brand/20 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
                <f.icon className="w-5 h-5 text-brand" />
              </div>
              <h3 className="font-bold mb-1.5">{f.title}</h3>
              <p className="text-xs text-ink-muted leading-relaxed">{f.desc}</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* ENGINE STRIP */}
      <section
        id="engine"
        className="bg-bg-800 border-y border-line py-16 px-4 lg:px-8">
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge tone="red" size="md">
              HIDDEN KNOWLEDGE
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold mt-4 leading-tight">
              See the market through an
              <br />
              <span className="text-brand">institutional lens.</span>
            </h2>
            <p className="text-ink-muted mt-4 leading-relaxed">
              The engine studies liquidity behavior, accumulation, manipulation
              and distribution cycles, order flow and technical confluence. It
              brings these inputs into one terminal-grade view so professional
              traders can evaluate setups and plan sniper-style entries with
              defined risk.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
              'Liquidity grabs and stop-hunt context',
              'Bull and bear trap detection',
              'Premium and discount zoning',
              'FVG and Order Block confluence',
              'Pakistan 10AM session breakout',
              'Multi-timeframe alignment scoring'].
              map((x) =>
              <li
                key={x}
                className="flex items-center gap-2 text-sm text-ink">
                
                  <TrendingUpIcon className="w-3.5 h-3.5 text-brand" />
                  {x}
                </li>
              )}
            </ul>
          </div>

          <div className="bg-bg-700 border border-line rounded-md p-6">
            <div className="text-2xs uppercase tracking-[0.18em] text-brand font-bold">
              BULLER TRADING WORKSPACE
            </div>
            <h3 className="mt-3 text-xl font-bold text-ink">Evidence before execution</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Live readings appear only inside the authenticated workspace when a verified market source is available. BULLER TRADING does not publish fabricated prices, timestamps, confidence scores or sample signals as live data.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {['Verified source status', 'Multi-timeframe context', 'Defined invalidation', 'Risk-aware trade planning'].map((item) =>
              <div key={item} className="rounded border border-line bg-bg-800 px-3 py-2 text-xs text-ink">
                  <CheckIcon className="mr-2 inline h-3.5 w-3.5 text-buy" />
                  {item}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* EXTERNAL BROKER ACCESS */}
      <section id="broker" className="py-16 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-bg-700 border border-line rounded-md p-6 lg:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-md bg-brand/10 border border-brand/25 flex items-center justify-center shrink-0">
                <LandmarkIcon className="w-5 h-5 text-brand" />
              </div>
              <div>
                <Badge tone="brand" size="sm">
                  OPTIONAL BROKER ACCESS
                </Badge>
                <h2 className="text-2xl lg:text-3xl font-bold mt-3">
                  Open Exness through the invitation link
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed mt-2 max-w-3xl">
                  Traders who want to explore Exness can use the official
                  external invitation link below. Exness is a separate
                  third-party broker and is not part of BULLER TRADING. It
                  does not provide, calculate or power BULLER TRADING
                  signals.
                </p>
                <div className="mt-3 flex items-start gap-2 text-2xs text-ink-dim leading-relaxed max-w-3xl">
                  <InfoIcon className="w-3.5 h-3.5 text-warn shrink-0 mt-0.5" />
                  <span>
                    Affiliate disclosure: this is a sponsored invitation link
                    and the website owner may receive a benefit if you register.
                    Broker availability, products and eligibility depend on your
                    jurisdiction. Review Exness terms independently.
                  </span>
                </div>
              </div>
            </div>
            <a
              href={EXNESS_INVITATION_URL}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 text-base font-medium text-white brand-glow transition-colors hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/50"
              aria-label="Visit Exness using the external invitation link in a new tab">
              
              <ExternalLinkIcon className="w-4 h-4" />
              Visit Exness
            </a>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge tone="brand" size="md">
            MEMBERSHIP PLANS
          </Badge>
          <h2 className="text-3xl lg:text-5xl font-bold mt-4">
            Choose your plan
          </h2>
          <p className="text-ink-muted mt-3 max-w-2xl mx-auto">
            Every plan unlocks the complete BULLER TRADING workspace and institutional suite. Plans differ only by validity and price. One secure device is included per account, with access activated after admin verification.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {plans.length === 0 &&
          <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-line bg-bg-700 p-8 text-center text-sm text-ink-muted">
              Plans are temporarily unavailable. Please contact support before making a payment.
            </div>
          }
          {plans.map((p) =>
          <div
            key={p.id}
            className={`relative rounded-md p-6 border ${p.popular ? 'border-brand bg-brand/5 brand-glow' : 'border-line bg-bg-700'}`}>
            
              {p.popular &&
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="brand" size="sm">
                    MOST POPULAR
                  </Badge>
                </div>
            }
              <div className="text-xs uppercase tracking-[0.18em] text-ink-muted font-bold">
                {p.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-ink">
                  {p.price}
                </span>
                <span className="text-xs text-ink-dim">
                  / {p.duration}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                {p.description}
              </p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f, i) =>
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-ink">
                
                    <CheckIcon className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                    {f}
                  </li>
              )}
              </ul>
              <Link to="/signup" className="block mt-5">
                <Button
                variant={p.popular ? 'primary' : 'secondary'}
                size="md"
                className="w-full">
                
                  Choose {p.name}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section id="access" className="py-24 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <LayersIcon className="w-10 h-10 text-brand mx-auto mb-4" />
          <h2 className="text-3xl lg:text-5xl font-bold">
            Private. Protected. Powerful.
          </h2>
          <p className="text-ink-muted mt-4 max-w-xl mx-auto">
            BULLER TRADING access is gated behind a master key issued only after payment
            is verified. Sign up to start the process.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/login">
              <Button
                variant="primary"
                size="lg"
                icon={<LockIcon className="w-4 h-4" />}>
                
                Unlock Access
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="secondary" size="lg">
                Sign Up (24h approval)
              </Button>
            </Link>
          </div>
          <p className="mt-8 text-2xs text-ink-dim leading-relaxed max-w-2xl mx-auto">
            Educational decision-support only—not financial advice. Trading
            Forex, Gold and Crypto involves substantial risk and losses can
            exceed expectations. Signals and analytical outputs are
            probabilistic, never guaranteed. Always perform your own research
            and use appropriate risk management.
          </p>
        </div>
      </section>

      <footer className="border-t border-line py-8 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-2xs text-ink-dim">
          <div className="space-y-3 text-center md:text-left">
            <div className="flex items-center justify-center gap-3 md:justify-start"><Logo size="sm" showText={false} /><span>BULLER TRADING · GOLD MARKET INTELLIGENCE</span></div>
            <PublicManagedLinks />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setDeviceModalOpen(true)}
              className="hover:text-ink transition-colors uppercase tracking-[0.18em]">
              
              Device Change Request
            </button>
            <span className="uppercase tracking-[0.18em]">
              Author · Syed Azhaad Hussain
            </span>
          </div>
        </div>
      </footer>

      <AccessRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
      <RegisterDeviceModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        lockEmail={false} />
      
    </div>);

}