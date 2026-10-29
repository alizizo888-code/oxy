import { Snowflake, Droplets, Zap, Lock, WashingMachine, Satellite, PaintRoller, BrickWall, Cctv, Thermometer, Sparkles, Bug, Container, Truck, Sun, Building2, Wrench, HardHat } from 'lucide-react'

// One modern line icon + accent palette per specialty (replaces the emoji tiles).
// g = gradient classes for the icon chip, glow = soft shadow colour.
export const SERVICE_ICON = {
  ac:          { Icon: Snowflake,      g: 'from-sky-400 to-blue-600',      glow: 'shadow-sky-400/40' },
  electric:    { Icon: Zap,            g: 'from-amber-400 to-orange-500',  glow: 'shadow-amber-400/40' },
  plumbing:    { Icon: Droplets,       g: 'from-cyan-400 to-sky-600',      glow: 'shadow-cyan-400/40' },
  locks:       { Icon: Lock,           g: 'from-indigo-400 to-violet-600', glow: 'shadow-indigo-400/40' },
  appliances:  { Icon: WashingMachine, g: 'from-violet-400 to-fuchsia-600',glow: 'shadow-violet-400/40' },
  satellite:   { Icon: Satellite,      g: 'from-slate-500 to-slate-800',   glow: 'shadow-slate-500/40' },
  paint:       { Icon: PaintRoller,    g: 'from-rose-400 to-pink-600',     glow: 'shadow-rose-400/40' },
  tiling:      { Icon: BrickWall,      g: 'from-orange-400 to-red-500',    glow: 'shadow-orange-400/40' },
  cameras:     { Icon: Cctv,           g: 'from-teal-400 to-emerald-600',  glow: 'shadow-teal-400/40' },
  fridge:      { Icon: Thermometer,    g: 'from-sky-300 to-cyan-600',      glow: 'shadow-cyan-400/40' },
  cleaning:    { Icon: Sparkles,       g: 'from-emerald-400 to-teal-600',  glow: 'shadow-emerald-400/40' },
  pest:        { Icon: Bug,            g: 'from-lime-400 to-green-600',    glow: 'shadow-lime-400/40' },
  tanks:       { Icon: Container,      g: 'from-blue-400 to-indigo-600',   glow: 'shadow-blue-400/40' },
  moving:      { Icon: Truck,          g: 'from-yellow-400 to-amber-600',  glow: 'shadow-yellow-400/40' },
  solar:       { Icon: Sun,            g: 'from-yellow-300 to-orange-500', glow: 'shadow-yellow-400/40' },
  corporate:   { Icon: Building2,      g: 'from-blue-500 to-slate-700',    glow: 'shadow-blue-400/40' },
  general:     { Icon: Wrench,         g: 'from-sky-500 to-indigo-600',    glow: 'shadow-sky-400/40' },
  contracting: { Icon: HardHat,        g: 'from-orange-400 to-amber-600',  glow: 'shadow-orange-400/40' },
}
export const iconFor = (id) => SERVICE_ICON[id] || SERVICE_ICON.general
