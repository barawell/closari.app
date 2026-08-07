'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { authFetch } from '@/lib/client-fetch'
import { supabase } from '@/lib/supabase'

// Nada notifikasi pesan masuk — di-generate via WebAudio (gak butuh file mp3).
let _audioCtx: AudioContext | null = null
function playNotifSound() {
  try {
    if (typeof window === 'undefined') return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!_audioCtx) _audioCtx = new Ctx()
    const ctx = _audioCtx
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    // dua nada pendek (ding-dong)
    ;[ [880, 0], [1180, 0.12] ].forEach(([freq, t]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq as number
      gain.gain.setValueAtTime(0.0001, now + (t as number))
      gain.gain.exponentialRampToValueAtTime(0.18, now + (t as number) + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (t as number) + 0.22)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(now + (t as number))
      osc.stop(now + (t as number) + 0.24)
    })
  } catch { /* ignore */ }
}

type Conv = { id: string; status: string; last_message_at: string; tags?: string[]; ai_paused?: boolean; contact: any }
type Msg = { id: string; wa_message_id?: string | null; direction: string; body: string; sender: string; created_at: string; status?: string; type?: string; media_url?: string | null; media_mime?: string | null; media_filename?: string | null; is_forwarded?: boolean; reply_to?: string | null; quoted?: { direction: string; type?: string; body?: string; is_media?: boolean } | null }
type ContactDetail = { contact: any; stats: { total_messages_in: number; total_messages_out: number; total_conversations: number; days_since_first_contact: number | null; days_since_last_order: number | null } }
type QuickReply = { id: string; shortcut: string; title: string; body: string }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j`
  return `${Math.floor(h / 24)}h`
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: '#F0F0F0', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 600, border: '1px solid #E5E5E5' }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function StatusIcon({ status }: { status?: string }) {
  if (!status || status === 'sent') return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (status === 'delivered') return <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6L9 9L14 3" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (status === 'read') return <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6L9 9L14 3" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (status === 'failed') return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#DC2626" strokeWidth="1.4"/><path d="M6 3.5V6.5M6 8.5V8.6" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/></svg>
  return null
}

// Emoji yang paling sering dipakai CS/sales (tanpa library tambahan).
const EMOJI_CATEGORIES: { key: string; icon: string; emojis: string[] }[] = [
  {
    key: 'Smiley', icon: '\u{1F600}',
    emojis: ['\u{1F600}','\u{1F603}','\u{1F604}','\u{1F601}','\u{1F606}','\u{1F605}','\u{1F923}','\u{1F602}','\u{1F642}','\u{1F643}','\u{1F609}','\u{1F60A}','\u{1F607}','\u{1F970}','\u{1F60D}','\u{1F929}','\u{1F618}','\u{1F617}','\u{263A}\u{FE0F}','\u{1F61A}','\u{1F619}','\u{1F972}','\u{1F60B}','\u{1F61B}','\u{1F61C}','\u{1F92A}','\u{1F61D}','\u{1F911}','\u{1F917}','\u{1F92D}','\u{1F92B}','\u{1F914}','\u{1F910}','\u{1F928}','\u{1F610}','\u{1F611}','\u{1F636}','\u{1F60F}','\u{1F612}','\u{1F644}','\u{1F62C}','\u{1F925}','\u{1F60C}','\u{1F614}','\u{1F62A}','\u{1F924}','\u{1F634}','\u{1F637}','\u{1F912}','\u{1F915}','\u{1F922}','\u{1F92E}','\u{1F927}','\u{1F975}','\u{1F976}','\u{1F974}','\u{1F635}','\u{1F92F}','\u{1F920}','\u{1F973}','\u{1F978}','\u{1F60E}','\u{1F913}','\u{1F9D0}','\u{1F615}','\u{1F61F}','\u{1F641}','\u{2639}\u{FE0F}','\u{1F62E}','\u{1F62F}','\u{1F632}','\u{1F633}','\u{1F97A}','\u{1F626}','\u{1F627}','\u{1F628}','\u{1F630}','\u{1F625}','\u{1F622}','\u{1F62D}','\u{1F631}','\u{1F616}','\u{1F623}','\u{1F61E}','\u{1F613}','\u{1F629}','\u{1F62B}','\u{1F971}','\u{1F624}','\u{1F621}','\u{1F620}','\u{1F92C}','\u{1F608}','\u{1F47F}','\u{1F480}','\u{1F4A9}','\u{1F921}','\u{1F479}','\u{1F47A}','\u{1F47B}','\u{1F47D}','\u{1F47E}','\u{1F916}','\u{1F63A}','\u{1F638}','\u{1F639}','\u{1F63B}','\u{1F63C}','\u{1F63D}','\u{1F640}','\u{1F63F}','\u{1F63E}'],
  },
  {
    key: 'Gestur', icon: '\u{1F44B}',
    emojis: ['\u{1F44B}','\u{1F91A}','\u{1F590}\u{FE0F}','\u{270B}','\u{1F596}','\u{1F44C}','\u{1F90C}','\u{1F90F}','\u{270C}\u{FE0F}','\u{1F91E}','\u{1F91F}','\u{1F918}','\u{1F919}','\u{1F448}','\u{1F449}','\u{1F446}','\u{1F595}','\u{1F447}','\u{261D}\u{FE0F}','\u{1F44D}','\u{1F44E}','\u{270A}','\u{1F44A}','\u{1F91B}','\u{1F91C}','\u{1F44F}','\u{1F64C}','\u{1F450}','\u{1F932}','\u{1F91D}','\u{1F64F}','\u{270D}\u{FE0F}','\u{1F485}','\u{1F933}','\u{1F4AA}','\u{1F9BE}','\u{1F9B5}','\u{1F9B6}','\u{1F442}','\u{1F443}','\u{1F9E0}','\u{1FAC0}','\u{1FAC1}','\u{1F9B7}','\u{1F9B4}','\u{1F440}','\u{1F441}\u{FE0F}','\u{1F445}','\u{1F444}','\u{1F476}','\u{1F9D2}','\u{1F466}','\u{1F467}','\u{1F9D1}','\u{1F468}','\u{1F469}','\u{1F9D3}','\u{1F474}','\u{1F475}','\u{1F64D}','\u{1F64E}','\u{1F645}','\u{1F646}','\u{1F481}','\u{1F64B}','\u{1F9CF}','\u{1F926}','\u{1F937}','\u{1F46E}','\u{1F575}\u{FE0F}','\u{1F482}','\u{1F477}','\u{1F934}','\u{1F478}','\u{1F470}','\u{1F935}','\u{1F930}','\u{1F929}','\u{1F473}','\u{1F472}','\u{1F9D5}','\u{1F9D4}','\u{1F471}','\u{1F9B8}','\u{1F9B9}','\u{1F9DE}','\u{1F9DF}','\u{1F646}','\u{1F937}','\u{1F486}','\u{1F487}','\u{1F6B6}','\u{1F9CD}','\u{1F9CE}','\u{1F3C3}','\u{1F483}','\u{1F57A}','\u{1F46F}','\u{1F9D6}','\u{1F9D7}'],
  },
  {
    key: 'Hati', icon: '\u{2764}\u{FE0F}',
    emojis: ['\u{2764}\u{FE0F}','\u{1F9E1}','\u{1F49B}','\u{1F49A}','\u{1F499}','\u{1F49C}','\u{1F5A4}','\u{1F90D}','\u{1F90E}','\u{1F494}','\u{2763}\u{FE0F}','\u{1F495}','\u{1F49E}','\u{1F493}','\u{1F497}','\u{1F496}','\u{1F498}','\u{1F49D}','\u{1F49F}','\u{2665}\u{FE0F}','\u{1F48C}','\u{1F48B}','\u{1F48D}','\u{1F48E}','\u{1F339}','\u{1F337}','\u{1F33B}','\u{1F33C}','\u{1F490}','\u{1F338}','\u{1F4AF}','\u{1F525}','\u{2B50}','\u{1F31F}','\u{2728}','\u{26A1}','\u{1F4A5}','\u{1F4AB}','\u{1F308}'],
  },
  {
    key: 'Hewan', icon: '\u{1F436}',
    emojis: ['\u{1F436}','\u{1F431}','\u{1F42D}','\u{1F439}','\u{1F430}','\u{1F98A}','\u{1F43B}','\u{1F43C}','\u{1F428}','\u{1F42F}','\u{1F981}','\u{1F42E}','\u{1F437}','\u{1F43D}','\u{1F438}','\u{1F435}','\u{1F648}','\u{1F649}','\u{1F64A}','\u{1F412}','\u{1F414}','\u{1F427}','\u{1F426}','\u{1F424}','\u{1F423}','\u{1F425}','\u{1F986}','\u{1F985}','\u{1F989}','\u{1F987}','\u{1F43A}','\u{1F417}','\u{1F434}','\u{1F984}','\u{1F41D}','\u{1F41B}','\u{1F98B}','\u{1F40C}','\u{1F41E}','\u{1F41C}','\u{1F997}','\u{1F577}\u{FE0F}','\u{1F982}','\u{1F422}','\u{1F40D}','\u{1F98E}','\u{1F995}','\u{1F996}','\u{1F419}','\u{1F991}','\u{1F990}','\u{1F980}','\u{1F421}','\u{1F420}','\u{1F41F}','\u{1F42C}','\u{1F433}','\u{1F40B}','\u{1F988}','\u{1F40A}','\u{1F405}','\u{1F406}','\u{1F993}','\u{1F98D}','\u{1F418}','\u{1F98F}','\u{1F42A}','\u{1F42B}','\u{1F992}','\u{1F998}','\u{1F403}','\u{1F402}','\u{1F404}','\u{1F40E}','\u{1F416}','\u{1F40F}','\u{1F411}','\u{1F410}','\u{1F98C}','\u{1F415}','\u{1F429}','\u{1F408}','\u{1F413}','\u{1F983}','\u{1F54A}\u{FE0F}','\u{1F407}','\u{1F401}','\u{1F400}','\u{1F43F}\u{FE0F}','\u{1F994}','\u{1F9A6}','\u{1F332}','\u{1F333}','\u{1F334}','\u{1F335}','\u{1F340}','\u{1F331}','\u{1F33F}','\u{2618}\u{FE0F}','\u{1F341}','\u{1F342}','\u{1F343}'],
  },
  {
    key: 'Makanan', icon: '\u{1F354}',
    emojis: ['\u{1F34F}','\u{1F34E}','\u{1F350}','\u{1F34A}','\u{1F34B}','\u{1F34C}','\u{1F349}','\u{1F347}','\u{1F353}','\u{1FAD0}','\u{1F348}','\u{1F352}','\u{1F351}','\u{1F96D}','\u{1F34D}','\u{1F965}','\u{1F95D}','\u{1F345}','\u{1F346}','\u{1F951}','\u{1F966}','\u{1F96C}','\u{1F952}','\u{1F336}\u{FE0F}','\u{1F33D}','\u{1F955}','\u{1F9C4}','\u{1F9C5}','\u{1F954}','\u{1F360}','\u{1F950}','\u{1F35E}','\u{1F956}','\u{1F968}','\u{1F9C0}','\u{1F95A}','\u{1F373}','\u{1F9C8}','\u{1F95E}','\u{1F9C7}','\u{1F953}','\u{1F969}','\u{1F357}','\u{1F356}','\u{1F32D}','\u{1F354}','\u{1F35F}','\u{1F355}','\u{1F96A}','\u{1F32E}','\u{1F32F}','\u{1F959}','\u{1F9C6}','\u{1F35C}','\u{1F372}','\u{1F35B}','\u{1F363}','\u{1F371}','\u{1F95F}','\u{1F364}','\u{1F359}','\u{1F35A}','\u{1F358}','\u{1F365}','\u{1F960}','\u{1F362}','\u{1F361}','\u{1F367}','\u{1F368}','\u{1F366}','\u{1F967}','\u{1F9C1}','\u{1F370}','\u{1F382}','\u{1F36E}','\u{1F36D}','\u{1F36C}','\u{1F36B}','\u{1F37F}','\u{1F369}','\u{1F36A}','\u{1F330}','\u{1F95C}','\u{2615}','\u{1F375}','\u{1F9C3}','\u{1F964}','\u{1F9CB}','\u{1F376}','\u{1F37A}','\u{1F37B}','\u{1F377}','\u{1F942}','\u{1F943}','\u{1F379}','\u{1F378}'],
  },
  {
    key: 'Aktivitas', icon: '\u{26BD}',
    emojis: ['\u{26BD}','\u{1F3C0}','\u{1F3C8}','\u{26BE}','\u{1F94E}','\u{1F3BE}','\u{1F3D0}','\u{1F3C9}','\u{1F94D}','\u{1F3B1}','\u{1F3D3}','\u{1F3F8}','\u{1F3D2}','\u{1F3D1}','\u{1F94C}','\u{26F3}','\u{1F3F9}','\u{1F3A3}','\u{1F94A}','\u{1F94B}','\u{1F3BD}','\u{26F8}\u{FE0F}','\u{1F94C}','\u{1F6F7}','\u{1F3BF}','\u{26F7}\u{FE0F}','\u{1F3C2}','\u{1F3CB}\u{FE0F}','\u{1F93C}','\u{1F938}','\u{26F9}\u{FE0F}','\u{1F93A}','\u{1F93E}','\u{1F3CC}\u{FE0F}','\u{1F3C7}','\u{1F9D8}','\u{1F3C4}','\u{1F3CA}','\u{1F93D}','\u{1F6A3}','\u{1F6B4}','\u{1F6B5}','\u{1F3AF}','\u{1F3AE}','\u{1F3B2}','\u{1F3B3}','\u{1F3AA}','\u{1F3AD}','\u{1F3AC}','\u{1F3A4}','\u{1F3A7}','\u{1F3BC}','\u{1F3B9}','\u{1F941}','\u{1F3B7}','\u{1F3BA}','\u{1F3B8}','\u{1FA95}','\u{1F3BB}','\u{1F3C6}','\u{1F947}','\u{1F948}','\u{1F949}','\u{1F3C5}','\u{1F396}\u{FE0F}','\u{1F397}\u{FE0F}','\u{1F39F}\u{FE0F}','\u{1F3AB}'],
  },
  {
    key: 'Perjalanan', icon: '\u{2708}\u{FE0F}',
    emojis: ['\u{1F697}','\u{1F695}','\u{1F699}','\u{1F68C}','\u{1F68E}','\u{1F3CE}\u{FE0F}','\u{1F693}','\u{1F691}','\u{1F692}','\u{1F690}','\u{1F69A}','\u{1F69B}','\u{1F69C}','\u{1F6F5}','\u{1F3CD}\u{FE0F}','\u{1F6B2}','\u{1F6F4}','\u{1F6F9}','\u{1F68F}','\u{1F6A8}','\u{1F6A5}','\u{1F6A6}','\u{1F6A7}','\u{2693}','\u{26F5}','\u{1F6A4}','\u{1F6F3}\u{FE0F}','\u{26F4}\u{FE0F}','\u{1F6A2}','\u{2708}\u{FE0F}','\u{1F6E9}\u{FE0F}','\u{1F681}','\u{1F69F}','\u{1F6A0}','\u{1F683}','\u{1F68A}','\u{1F682}','\u{1F686}','\u{1F687}','\u{1F68D}','\u{1F684}','\u{1F685}','\u{1F6F0}\u{FE0F}','\u{1F680}','\u{1F6F8}','\u{1F30D}','\u{1F30E}','\u{1F30F}','\u{1F5FA}\u{FE0F}','\u{1F5FF}','\u{1F3D4}\u{FE0F}','\u{26F0}\u{FE0F}','\u{1F30B}','\u{1F3D5}\u{FE0F}','\u{1F3D6}\u{FE0F}','\u{1F3DC}\u{FE0F}','\u{1F3DD}\u{FE0F}','\u{1F3DE}\u{FE0F}','\u{1F3DF}\u{FE0F}','\u{1F3DB}\u{FE0F}','\u{1F3D7}\u{FE0F}','\u{1F3E0}','\u{1F3E1}','\u{1F3E2}','\u{1F3EC}','\u{1F3E3}','\u{1F3E5}','\u{1F3E6}','\u{1F3E8}','\u{1F3EA}','\u{1F3EB}','\u{1F3E9}','\u{1F492}','\u{1F3DB}\u{FE0F}','\u{26EA}','\u{1F54C}','\u{1F6D5}','\u{1F54D}','\u{26E9}\u{FE0F}','\u{1F5FC}','\u{1F3AA}','\u{1F305}','\u{1F304}','\u{1F303}','\u{1F3D9}\u{FE0F}','\u{1F306}','\u{1F307}','\u{1F309}','\u{2668}\u{FE0F}','\u{1F3A0}','\u{1F3A1}','\u{1F3A2}'],
  },
  {
    key: 'Objek', icon: '\u{1F4A1}',
    emojis: ['\u{231A}','\u{1F4F1}','\u{1F4F2}','\u{1F4BB}','\u{2328}\u{FE0F}','\u{1F5A5}\u{FE0F}','\u{1F5A8}\u{FE0F}','\u{1F5B1}\u{FE0F}','\u{1F4BD}','\u{1F4BE}','\u{1F4BF}','\u{1F4C0}','\u{1F4FC}','\u{1F4F7}','\u{1F4F8}','\u{1F4F9}','\u{1F3A5}','\u{1F4FD}\u{FE0F}','\u{1F39E}\u{FE0F}','\u{1F4DE}','\u{260E}\u{FE0F}','\u{1F4DF}','\u{1F4E0}','\u{1F4FA}','\u{1F4FB}','\u{1F399}\u{FE0F}','\u{1F39A}\u{FE0F}','\u{1F39B}\u{FE0F}','\u{23F1}\u{FE0F}','\u{23F2}\u{FE0F}','\u{23F0}','\u{1F550}','\u{231B}','\u{23F3}','\u{1F50B}','\u{1F50C}','\u{1F4A1}','\u{1F526}','\u{1F56F}\u{FE0F}','\u{1F9EF}','\u{1F6E2}\u{FE0F}','\u{1F4B8}','\u{1F4B5}','\u{1F4B4}','\u{1F4B6}','\u{1F4B7}','\u{1F4B0}','\u{1F4B3}','\u{1F9FE}','\u{1F48E}','\u{2696}\u{FE0F}','\u{1F527}','\u{1F528}','\u{2699}\u{FE0F}','\u{1F9F0}','\u{1F529}','\u{26D3}\u{FE0F}','\u{1F517}','\u{1F4E6}','\u{1F4EB}','\u{1F4EE}','\u{1F4DD}','\u{1F4C4}','\u{1F4C3}','\u{1F4D1}','\u{1F4CA}','\u{1F4C8}','\u{1F4C9}','\u{1F5C2}\u{FE0F}','\u{1F4C5}','\u{1F4C6}','\u{1F5D3}\u{FE0F}','\u{1F4C7}','\u{1F5C3}\u{FE0F}','\u{1F5C4}\u{FE0F}','\u{1F4CB}','\u{1F4CC}','\u{1F4CD}','\u{1F4CE}','\u{1F587}\u{FE0F}','\u{1F4CF}','\u{1F4D0}','\u{2702}\u{FE0F}','\u{1F512}','\u{1F513}','\u{1F511}','\u{1F5DD}\u{FE0F}','\u{1F4D6}','\u{1F4DA}','\u{1F4CE}','\u{1F58A}\u{FE0F}','\u{270F}\u{FE0F}','\u{1F58D}\u{FE0F}'],
  },
  {
    key: 'Simbol', icon: '\u{2705}',
    emojis: ['\u{2705}','\u{2611}\u{FE0F}','\u{2714}\u{FE0F}','\u{274C}','\u{2B55}','\u{274E}','\u{2733}\u{FE0F}','\u{2734}\u{FE0F}','\u{2747}\u{FE0F}','\u{203C}\u{FE0F}','\u{2049}\u{FE0F}','\u{2753}','\u{2754}','\u{2755}','\u{2757}','\u{26A0}\u{FE0F}','\u{1F6AB}','\u{1F4AF}','\u{1F525}','\u{2B50}','\u{1F31F}','\u{2728}','\u{26A1}','\u{1F4A5}','\u{1F4AB}','\u{1F4A6}','\u{1F4A8}','\u{1F389}','\u{1F38A}','\u{1F3F7}\u{FE0F}','\u{1F516}','\u{1F48A}','\u{1FA79}','\u{1F489}','\u{1FA7A}','\u{1F321}\u{FE0F}','\u{267B}\u{FE0F}','\u{2695}\u{FE0F}','\u{1F51E}','\u{1F4F5}','\u{1F507}','\u{1F50A}','\u{1F514}','\u{1F515}','\u{2795}','\u{2796}','\u{2797}','\u{2716}\u{FE0F}','\u{1F4B2}','\u{00A9}\u{FE0F}','\u{00AE}\u{FE0F}','\u{2122}\u{FE0F}','\u{1F197}','\u{1F195}','\u{1F193}','\u{1F51D}','\u{25B6}\u{FE0F}','\u{23F8}\u{FE0F}','\u{23F9}\u{FE0F}','\u{23FA}\u{FE0F}','\u{23ED}\u{FE0F}','\u{23EE}\u{FE0F}','\u{1F500}','\u{1F501}','\u{1F502}','\u{2764}\u{FE0F}','\u{1F49B}','\u{1F49A}','\u{1F499}','\u{1F49C}','\u{1F5A4}','\u{1F90D}','\u{1F90E}','\u{1F494}','\u{1F1EE}\u{1F1E9}'],
  },
]
const EMOJIS = EMOJI_CATEGORIES.flatMap(c => c.emojis)

// Render media (foto / video / audio / dokumen) di dalam bubble.
function MediaBubble({ m, light, onOpen }: { m: Msg; light: boolean; onOpen?: (m: Msg) => void }) {
  const mime = m.media_mime || ''
  const url = m.media_url || ''

  // Lokasi → kartu peta yang bisa dibuka di Google Maps
  if (m.type === 'location' || mime === 'geo/location') {
    if (!url) return <div style={{ fontSize: 12 }}>📍 {m.body || 'Lokasi'}</div>
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: light ? '#fff' : '#0D0D0D', padding: '4px 0' }}>
        <div style={{ width: 34, height: 34, borderRadius: 7, background: light ? 'rgba(255,255,255,0.18)' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 14.5s5-4.2 5-8a5 5 0 10-10 0c0 3.8 5 8 5 8Z" stroke={light ? '#fff' : '#16A34A'} strokeWidth="1.3" strokeLinejoin="round"/><circle cx="8" cy="6.5" r="1.8" stroke={light ? '#fff' : '#16A34A'} strokeWidth="1.3"/></svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>{m.body || 'Lokasi dibagikan'}</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>Ketuk untuk buka di Google Maps</div>
        </div>
      </a>
    )
  }

  if (!url) {
    return <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.7 }}>📎 {m.media_filename || m.type || 'lampiran'} (gagal dimuat)</div>
  }
  if (mime.startsWith('image/') || m.type === 'image' || m.type === 'sticker') {
    // Buka di lightbox dalam window (bukan tab baru)
    return <img src={url} alt="" onClick={() => onOpen?.(m)} style={{ maxWidth: 240, maxHeight: 280, borderRadius: 8, display: 'block', objectFit: 'cover', cursor: 'zoom-in' }} />
  }
  if (mime.startsWith('video/') || m.type === 'video') {
    return <video src={url} controls style={{ maxWidth: 260, borderRadius: 8, display: 'block' }} />
  }
  if (mime.startsWith('audio/') || m.type === 'audio' || m.type === 'voice') {
    return <audio src={url} controls style={{ maxWidth: 240 }} />
  }
  // dokumen → buka di panel viewer dalam window
  return (
    <div onClick={() => onOpen?.(m)} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: light ? '#fff' : '#0D0D0D', padding: '4px 0' }}>
      <div style={{ width: 34, height: 34, borderRadius: 7, background: light ? 'rgba(255,255,255,0.18)' : '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5L12.5 5v9.5H4V1.5Z" stroke={light ? '#fff' : '#16A34A'} strokeWidth="1.3" strokeLinejoin="round"/><path d="M9 1.5V5h3.5" stroke={light ? '#fff' : '#16A34A'} strokeWidth="1.3" strokeLinejoin="round"/></svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{m.media_filename || 'Dokumen'}</div>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Ketuk untuk lihat</div>
      </div>
    </div>
  )
}

// Penampil media dalam window (gambar zoom / dokumen preview) — tidak ke tab baru.
function MediaViewer({ m, onClose }: { m: Msg; onClose: () => void }) {
  const mime = m.media_mime || ''
  const url = m.media_url || ''
  const isImage = mime.startsWith('image/') || m.type === 'image' || m.type === 'sticker'
  const isPdf = mime.includes('pdf') || (m.media_filename || '').toLowerCase().endsWith('.pdf')
  const name = m.media_filename || (isImage ? 'Gambar' : 'Dokumen')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: '#fff', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{name}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href={url} download={name} style={{ fontSize: 12, color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 6, padding: '6px 12px' }}>⬇ Unduh</a>
          <button onClick={onClose} style={{ fontSize: 22, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 6px' }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px 16px' }} onClick={e => e.stopPropagation()}>
        {isImage ? (
          <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />
        ) : isPdf ? (
          <iframe src={url} title={name} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 6, background: '#fff' }} />
        ) : (
          <div style={{ background: '#fff', borderRadius: 10, padding: '32px 28px', textAlign: 'center', maxWidth: 340 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', marginBottom: 4, wordBreak: 'break-word' }}>{name}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 18 }}>Pratinjau tidak tersedia untuk tipe file ini.</div>
            <a href={url} download={name} style={{ display: 'inline-block', background: '#0D0D0D', color: '#fff', fontSize: 13, fontWeight: 500, textDecoration: 'none', borderRadius: 7, padding: '10px 20px' }}>⬇ Unduh file</a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InboxPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [active, setActive] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null)
  const [forwardPick, setForwardPick] = useState<Msg | null>(null)   // pesan yg mau diteruskan → buka modal pilih tujuan
  const [forwardSearch, setForwardSearch] = useState('')
  const [forwardSending, setForwardSending] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Msg | null>(null)
  const [sending, setSending] = useState(false)
  const [copilot, setCopilot] = useState<{ intent: string; suggestion: string } | null>(null)
  const [coLoading, setCoLoading] = useState(false)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [newTag, setNewTag] = useState('')
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [showQR, setShowQR] = useState(false)
  const [rightTab, setRightTab] = useState<'contact' | 'copilot'>('contact')
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Conv[] | null>(null)
  const [hasMoreConvs, setHasMoreConvs] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [emojiSearch, setEmojiSearch] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const [sendingMedia, setSendingMedia] = useState(false)
  const [pending, setPending] = useState<{ file: File; url: string; isImage: boolean } | null>(null)
  const [caption, setCaption] = useState('')
  const [showLoc, setShowLoc] = useState(false)
  const [locForm, setLocForm] = useState({ latitude: '', longitude: '', name: '', address: '' })
  const [locBusy, setLocBusy] = useState(false)
  const [locErr, setLocErr] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [showInfoMobile, setShowInfoMobile] = useState(false)
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({})
  const [togglingAi, setTogglingAi] = useState(false)
  const [readMap, setReadMap] = useState<Record<string, number>>({})
  const seededRef = useRef(false)
  const tenantIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const endRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<Conv | null>(null)
  activeRef.current = active
  tenantIdRef.current = tenantId
  const soundRef = useRef(true)
  soundRef.current = soundOn

  // Load sound preference (in-memory only; resets per session)
  function toggleSound() {
    setSoundOn(v => {
      const next = !v
      // unlock audio on user gesture
      if (next) playNotifSound()
      return next
    })
  }

  const contactOf = (c: Conv) => (Array.isArray(c?.contact) ? c.contact[0] : c?.contact) || {}

  const loadConvs = useCallback(async () => {
    const res = await authFetch('/api/inbox/conversations')
    const j = await res.json()
    setConvs(j.conversations || [])
    setHasMoreConvs(!!j.has_more)
  }, [])

  // Debounce: kalau pesan masuk beruntun, jangan fetch + render ulang daftar
  // tiap pesan (itu bikin lag + daftar loncat-loncat sehingga salah klik room).
  // Gabungkan jadi satu refresh per ~800ms.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleLoadConvs = useCallback(() => {
    if (refetchTimer.current) return
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null
      loadConvs()
    }, 800)
  }, [loadConvs])

  // Muat percakapan lebih lama (riwayat penuh, bukan cuma yang terbaru)
  async function loadMoreConvs() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await authFetch(`/api/inbox/conversations?offset=${convs.length}`)
      const j = await res.json()
      const more: Conv[] = j.conversations || []
      setConvs(prev => {
        const seen = new Set(prev.map(c => c.id))
        return [...prev, ...more.filter(c => !seen.has(c.id))]
      })
      setHasMoreConvs(!!j.has_more)
    } finally { setLoadingMore(false) }
  }

  const loadMsgs = useCallback(async (id: string) => {
    const res = await authFetch(`/api/inbox/messages?conversation_id=${id}`)
    const j = await res.json()
    setMsgs(j.messages || [])
    setHasOlder(!!j.has_more)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    setUnread(prev => ({ ...prev, [id]: 0 }))
  }, [])

  // Muat pesan yang lebih lama di percakapan ini (riwayat chat lengkap)
  async function loadOlderMsgs() {
    if (!active || loadingOlder || !msgs.length) return
    setLoadingOlder(true)
    try {
      const oldest = msgs[0].created_at
      const res = await authFetch(`/api/inbox/messages?conversation_id=${active.id}&before=${encodeURIComponent(oldest)}`)
      const j = await res.json()
      const older: Msg[] = j.messages || []
      setMsgs(prev => {
        const seen = new Set(prev.map(m => m.id))
        return [...older.filter(m => !seen.has(m.id)), ...prev]
      })
      setHasOlder(!!j.has_more)
    } finally { setLoadingOlder(false) }
  }

  // Tandai percakapan sudah dibaca, disimpan ke localStorage per workspace (persist saat reload).
  const markRead = useCallback((convId: string) => {
    setReadMap(prev => {
      const next = { ...prev, [convId]: Date.now() }
      try { localStorage.setItem('closari_inbox_read_' + (tenantIdRef.current || 'x'), JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Muat status baca tersimpan; pertama kali pakai: anggap semua percakapan saat ini sudah dibaca.
  useEffect(() => {
    if (!tenantId || seededRef.current || convs.length === 0) return
    seededRef.current = true
    try {
      const key = 'closari_inbox_read_' + tenantId
      const raw = localStorage.getItem(key)
      if (raw) { setReadMap(JSON.parse(raw)); return }
      const seed: Record<string, number> = {}
      for (const c of convs) seed[c.id] = c.last_message_at ? new Date(c.last_message_at).getTime() : Date.now()
      localStorage.setItem(key, JSON.stringify(seed))
      setReadMap(seed)
    } catch {}
  }, [tenantId, convs])

  // Cari ke SERVER: nama, nomor, dan isi pesan — seluruh riwayat, bukan cuma yang ter-load.
  useEffect(() => {
    const q = search.trim()
    if (!q) { setSearchResults(null); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/inbox/conversations?q=${encodeURIComponent(q)}`)
        const j = await res.json()
        setSearchResults(j.conversations || [])
      } catch { setSearchResults(null) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  async function loadContactDetail(contactId: string) {
    if (!contactId) return
    const res = await authFetch(`/api/contacts/${contactId}`)
    const j = await res.json()
    if (res.ok) {
      setContactDetail(j)
      setNotesDraft(j.contact?.notes || '')
    }
  }

  async function loadCopilot(id: string) {
    setCoLoading(true); setCopilot(null)
    try {
      const res = await authFetch('/api/inbox/copilot', { method: 'POST', body: JSON.stringify({ conversation_id: id }) })
      const j = await res.json()
      if (res.ok) setCopilot({ intent: j.intent || '', suggestion: j.suggestion || '' })
    } finally { setCoLoading(false) }
  }

  // Load quick replies once
  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/quick-replies')
      const j = await res.json()
      setQuickReplies(j.quick_replies || [])
    })()
  }, [])

  // Ambil tenant id (buat filter realtime per-tenant)
  useEffect(() => {
    (async () => {
      const res = await authFetch('/api/me')
      const j = await res.json()
      setTenantId(j?.tenant?.id || null)
    })()
  }, [])

  // Realtime — DIFILTER per tenant biar tidak bocor antar client
  useEffect(() => {
    loadConvs()
    if (!tenantId) return // tunggu tenantId siap dulu

    const channel = supabase
      .channel('inbox-realtime-' + tenantId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages', filter: 'tenant_id=eq.' + tenantId },
        (payload) => {
          const newMsg = payload.new as Msg & { conversation_id: string; direction: string; sender: string }
          const convId = newMsg.conversation_id
          // Nada notif untuk pesan masuk dari customer (bukan balasan kita sendiri)
          if (newMsg.direction === 'in' && newMsg.sender === 'contact' && soundRef.current) {
            playNotifSound()
          }
          if (activeRef.current?.id === convId) {
            markRead(convId)
            setMsgs(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev
              // Ganti bubble optimistic (opt-) dgn pesan asli dari DB biar tidak dobel
              // & status (centang) bisa update. Cocokkan arah + isi.
              const idx = prev.findIndex(m => typeof m.id === 'string' && m.id.startsWith('opt-') && m.direction === newMsg.direction && (m.body || '') === (newMsg.body || ''))
              if (idx !== -1) { const c = [...prev]; c[idx] = newMsg; return c }
              return [...prev, newMsg]
            })
            setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          } else {
            setUnread(prev => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }))
          }
          scheduleLoadConvs()
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_messages', filter: 'tenant_id=eq.' + tenantId },
        (payload) => {
          const updated = payload.new as Msg
          setMsgs(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m))
        })
      .subscribe()

    return () => { supabase.removeChannel(channel); if (refetchTimer.current) { clearTimeout(refetchTimer.current); refetchTimer.current = null } }
  }, [loadConvs, scheduleLoadConvs, tenantId])

  // Jaring pengaman: refresh daftar tiap 15 detik agar pesan baru tetap ke-tandai walau realtime telat/mati.
  useEffect(() => {
    const iv = setInterval(() => { loadConvs() }, 15000)
    return () => clearInterval(iv)
  }, [loadConvs])

  useEffect(() => {
    if (active) {
      loadMsgs(active.id)
      markRead(active.id)
      const ct = contactOf(active)
      if (ct.id) loadContactDetail(ct.id)
      setRightTab('contact')
    }
  }, [active, loadMsgs])

  // Teruskan pesan ke percakapan/kontak LAIN yang dipilih.
  async function forwardTo(target: Conv) {
    if (!forwardPick) return
    setForwardSending(target.id)
    try {
      const res = await authFetch('/api/inbox/send', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: target.id, text: forwardPick.body || '', forward: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert(j.error || 'Gagal meneruskan'); return }
      setForwardPick(null)
      // Kalau kebetulan tujuannya percakapan yang sedang dibuka, refresh biar langsung muncul.
      if (active && target.id === active.id) loadMsgs(active.id)
    } finally { setForwardSending(null) }
  }

  // Esc: tutup overlay yang terbuka dulu; kalau tidak ada, batal pilih room (seperti WA).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (viewer) { setViewer(null); return }
      if (forwardPick) { setForwardPick(null); return }
      if (showEmoji) { setShowEmoji(false); return }
      if (replyingTo) { setReplyingTo(null); return }
      if (active) { setActive(null); setShowInfoMobile(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer, forwardPick, showEmoji, replyingTo, active])

  // Loncat ke pesan yang di-reply (klik kutipan) + kedip highlight sebentar.
  function scrollToMessage(waId: string) {
    const el = document.querySelector(`[data-mid="${waId}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const bubble = el.firstElementChild as HTMLElement | null
    const target = bubble || el
    const prev = target.style.transition
    target.style.transition = 'background-color 0.25s'
    target.style.backgroundColor = 'rgba(22,163,74,0.16)'
    setTimeout(() => { target.style.backgroundColor = ''; target.style.transition = prev }, 1100)
  }

  // Ambil alih / kembalikan ke AI untuk percakapan aktif.
  async function toggleAiHandover() {
    if (!active || togglingAi) return
    const current = pausedMap[active.id] ?? active.ai_paused ?? false
    const next = !current
    setTogglingAi(true)
    setPausedMap(prev => ({ ...prev, [active.id]: next }))   // optimistic
    try {
      const res = await authFetch('/api/inbox/ai-toggle', {
        method: 'POST', body: JSON.stringify({ conversation_id: active.id, paused: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error || 'Gagal mengubah status AI')
        setPausedMap(prev => ({ ...prev, [active.id]: current }))   // rollback
      }
    } catch {
      setPausedMap(prev => ({ ...prev, [active.id]: current }))
    } finally { setTogglingAi(false) }
  }

  async function send() {
    if (!active || !text.trim()) return
    setSending(true)
    const optimistic: Msg = { id: `opt-${Date.now()}`, direction: 'out', body: text, sender: 'agent', created_at: new Date().toISOString(), status: 'sending', quoted: replyingTo ? { direction: replyingTo.direction, body: replyingTo.body, is_media: !!replyingTo.media_mime } : null }
    setMsgs(prev => [...prev, optimistic])
    const textToSend = text
    setText('')
    setReplyingTo(null)
    setShowQR(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await authFetch('/api/inbox/send', { method: 'POST', body: JSON.stringify({ conversation_id: active.id, text: textToSend, reply_to: replyingTo?.wa_message_id || undefined }) })
      const j = await res.json()
      if (!res.ok) {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'failed' } : m))
        alert(j.error || 'Gagal kirim')
      } else {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? { ...m, status: 'sent' } : m))
      }
    } finally { setSending(false) }
  }

  async function saveNotes() {
    if (!contactDetail?.contact?.id) return
    setSavingNotes(true)
    try {
      const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ notes: notesDraft }) })
      if (res.ok) {
        setContactDetail(prev => prev ? { ...prev, contact: { ...prev.contact, notes: notesDraft } } : null)
      }
    } finally { setSavingNotes(false) }
  }

  async function addTag() {
    if (!contactDetail?.contact?.id || !newTag.trim()) return
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30)
    const currentTags = contactDetail.contact.tags || []
    if (currentTags.includes(tag)) { setNewTag(''); return }
    const updated = [...currentTags, tag]
    const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ tags: updated }) })
    if (res.ok) {
      setContactDetail(prev => prev ? { ...prev, contact: { ...prev.contact, tags: updated } } : null)
      setNewTag('')
    }
  }

  async function removeTag(tag: string) {
    if (!contactDetail?.contact?.id) return
    const updated = (contactDetail.contact.tags || []).filter((t: string) => t !== tag)
    const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ tags: updated }) })
    if (res.ok) {
      setContactDetail(prev => prev ? { ...prev, contact: { ...prev.contact, tags: updated } } : null)
    }
  }

  async function markOrder() {
    if (!contactDetail?.contact?.id) return
    const res = await authFetch(`/api/contacts/${contactDetail.contact.id}`, { method: 'PUT', body: JSON.stringify({ mark_order: true }) })
    if (res.ok) loadContactDetail(contactDetail.contact.id)
  }

  // Pilih file → TAMPILKAN PREVIEW dulu (tidak langsung kirim)
  function pickFile(file: File) {
    const isImage = (file.type || '').startsWith('image/')
    setCaption('')
    setPending({ file, url: URL.createObjectURL(file), isImage })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function cancelPending() {
    if (pending) URL.revokeObjectURL(pending.url)
    setPending(null)
    setCaption('')
  }

  // Kirim file yang sedang di-preview (beserta caption)
  async function sendPending() {
    if (!active || !pending || sendingMedia) return
    setSendingMedia(true)
    try {
      const fd = new FormData()
      fd.append('file', pending.file)
      fd.append('conversation_id', active.id)
      if (caption.trim()) fd.append('caption', caption.trim())
      const res = await authFetch('/api/inbox/media', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert(j.error || 'Gagal kirim file'); return }
      cancelPending()
      loadMsgs(active.id)
    } finally {
      setSendingMedia(false)
    }
  }

  // Ambil lokasi saat ini dari GPS browser
  function useMyLocation() {
    setLocErr(null)
    if (!navigator.geolocation) { setLocErr('Browser tidak mendukung GPS.'); return }
    setLocBusy(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocForm(f => ({ ...f, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) }))
        setLocBusy(false)
      },
      err => { setLocErr(err.message || 'Gagal ambil lokasi. Izinkan akses lokasi di browser.'); setLocBusy(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  async function sendLocationMsg() {
    if (!active || locBusy) return
    setLocErr(null)
    const lat = Number(locForm.latitude), lng = Number(locForm.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setLocErr('Latitude & longitude wajib diisi.'); return }
    setLocBusy(true)
    try {
      const res = await authFetch('/api/inbox/location', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: active.id, latitude: lat, longitude: lng, name: locForm.name, address: locForm.address }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setLocErr(j.error || 'Gagal kirim lokasi'); return }
      setShowLoc(false)
      setLocForm({ latitude: '', longitude: '', name: '', address: '' })
      loadMsgs(active.id)
    } finally { setLocBusy(false) }
  }

  function handleTextChange(v: string) {
    setText(v)
    // Toggle quick reply picker kalau text dimulai "/"
    setShowQR(v.startsWith('/'))
  }

  function applyQuickReply(qr: QuickReply) {
    setText(qr.body)
    setShowQR(false)
  }

  // Hasil pencarian dari server (nama / nomor / ISI PESAN). Kalau server tak balas,
  // fallback ke filter lokal biar tetap responsif.
  const filteredConvs = search.trim() && searchResults !== null ? searchResults : search.trim() ? convs.filter(c => {
    const ct = contactOf(c)
    const q = search.toLowerCase()
    return (ct.name || '').toLowerCase().includes(q) || (ct.phone || '').includes(q)
  }) : convs

  const filteredQR = text.startsWith('/') ? quickReplies.filter(q => q.shortcut.startsWith(text.slice(1).toLowerCase())) : quickReplies

  return (
    <div className={`inbox-shell${active ? ' has-active' : ''}${showInfoMobile ? ' show-info' : ''}`} style={{ display: 'flex', height: '100vh', background: '#fff' }}>
      <style>{`
        .msg-actions { opacity: 0; transition: opacity 0.12s; }
        .msg-row:hover .msg-actions { opacity: 1; }
        @media (hover: none) { .msg-actions { opacity: 1; } }
      `}</style>
      {viewer && <MediaViewer m={viewer} onClose={() => setViewer(null)} />}

      {forwardPick && (
        <div onClick={() => setForwardPick(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D' }}>Teruskan ke…</div>
                <button onClick={() => setForwardPick(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9CA3AF', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <div style={{ background: '#F7F7F7', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: '#6B7280', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📤 {forwardPick.body || (forwardPick.media_mime ? '📎 Lampiran' : 'Pesan')}
              </div>
              <input value={forwardSearch} onChange={e => setForwardSearch(e.target.value)} placeholder="Cari kontak…" autoFocus
                style={{ width: '100%', padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {convs
                .filter(c => {
                  const ct = contactOf(c); const q = forwardSearch.toLowerCase().trim()
                  if (!q) return true
                  return (ct.name || '').toLowerCase().includes(q) || (ct.phone || '').includes(q)
                })
                .map(c => {
                  const ct = contactOf(c)
                  return (
                    <div key={c.id} onClick={() => forwardSending ? null : forwardTo(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid #F7F7F7', cursor: forwardSending ? 'wait' : 'pointer', opacity: forwardSending && forwardSending !== c.id ? 0.5 : 1 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                        {(ct.name || ct.phone || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct.name || ct.phone || 'Tanpa nama'}</div>
                        {ct.name && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{ct.phone}</div>}
                      </div>
                      {forwardSending === c.id && <span style={{ fontSize: 11, color: '#16A34A', flexShrink: 0 }}>mengirim…</span>}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
      {/* LEFT: CONVERSATION LIST */}
      <div className="inbox-list" style={{ width: 280, borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>Percakapan</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{convs.length} aktif · realtime</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={toggleSound} title={soundOn ? 'Nada notif: ON' : 'Nada notif: OFF'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: soundOn ? '#16A34A' : '#D4D4D4' }}>
                {soundOn ? (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 6v3h2l3 2.5v-8L5 6H3Z" fill="currentColor"/><path d="M10 5.5C10.7 6.2 11 6.8 11 7.5C11 8.2 10.7 8.8 10 9.5M11.5 4C12.7 5 13 6.2 13 7.5C13 8.8 12.7 10 11.5 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 6v3h2l3 2.5v-8L5 6H3Z" fill="currentColor"/><path d="M10 6L13 9M13 6L10 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                )}
              </button>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 2px #F0FDF4' }} title="Realtime aktif" />
            </div>
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, nomor, atau isi chat…"
            style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 5, background: '#F7F7F7', color: '#0D0D0D', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConvs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6 }}>
                {searching ? 'Mencari…' : search ? 'Tidak ada hasil.' : <>Belum ada percakapan.<br />Pesan masuk otomatis muncul di sini.</>}
              </div>
            </div>
          ) : filteredConvs.map(c => {
            const ct = contactOf(c)
            const isActive = active?.id === c.id
            const badge = unread[c.id] || 0
            const lastMs = c.last_message_at ? new Date(c.last_message_at).getTime() : 0
            const isUnread = !isActive && (badge > 0 || lastMs > (readMap[c.id] || 0))
            const tags = ct.tags || []
            return (
              <div key={c.id} onClick={() => { setActive(c); setShowInfoMobile(false) }} style={{ padding: '10px 14px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer', background: isActive ? '#F0FDF4' : isUnread ? '#F4FDF8' : '#fff', borderLeft: `2px solid ${isActive || isUnread ? '#16A34A' : 'transparent'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {isUnread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />}
                    <div style={{ fontWeight: isUnread ? 700 : 500, fontSize: 13, color: '#0D0D0D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ct.name || ct.phone}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    {badge > 0 && (
                      <span style={{ background: '#16A34A', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999, minWidth: 16, textAlign: 'center' }}>{badge}</span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: isUnread ? 600 : 400, color: isUnread ? '#16A34A' : '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {ct.phone}
                  {ct.opted_out && <span style={{ color: '#DC2626' }}>· opt-out</span>}
                </div>
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {tags.slice(0, 3).map((t: string) => (
                      <span key={t} style={{ fontSize: 9, padding: '1px 5px', background: '#F0FDF4', color: '#15803D', borderRadius: 3, border: '1px solid #BBF7D0', fontWeight: 500 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {!search.trim() && hasMoreConvs && (
            <div style={{ padding: '10px 14px' }}>
              <button onClick={loadMoreConvs} disabled={loadingMore}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 7, background: '#fff', border: '1px solid #E5E5E5', color: '#6B7280', fontSize: 12, fontWeight: 500, cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {loadingMore ? 'Memuat…' : 'Muat percakapan lama'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MIDDLE: CHAT */}
      <div className="inbox-chat" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E5E5' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.7 }}>Pilih percakapan<br />untuk mulai membalas</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 10, background: '#fff' }}>
              <button onClick={() => setActive(null)} className="inbox-mobile-only" aria-label="Kembali" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4, color: '#0D0D0D' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <Avatar name={contactOf(active).name || contactOf(active).phone} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#0D0D0D' }}>{contactOf(active).name || contactOf(active).phone}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{contactOf(active).phone}</div>
              </div>
              {(() => {
                const paused = pausedMap[active.id] ?? active.ai_paused ?? false
                return (
                  <button onClick={toggleAiHandover} disabled={togglingAi} title={paused ? 'AI sedang nonaktif — kamu yang pegang chat ini' : 'Ambil alih chat ini dari AI'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: togglingAi ? 'wait' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      border: `1px solid ${paused ? '#FCA5A5' : '#BBF7D0'}`,
                      background: paused ? '#FEF2F2' : '#F0FDF4',
                      color: paused ? '#DC2626' : '#15803D' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: paused ? '#DC2626' : '#16A34A', flexShrink: 0 }} />
                    {paused ? 'Kembalikan ke AI' : 'Ambil alih'}
                  </button>
                )
              })()}
              <button onClick={() => setShowInfoMobile(true)} className="inbox-mobile-only" aria-label="Info kontak" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M10 9v4M10 6.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#FAFAFA' }}>
              {hasOlder && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                  <button onClick={loadOlderMsgs} disabled={loadingOlder}
                    style={{ padding: '6px 14px', borderRadius: 999, background: '#fff', border: '1px solid #E5E5E5', color: '#6B7280', fontSize: 12, fontWeight: 500, cursor: loadingOlder ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {loadingOlder ? 'Memuat…' : '↑ Muat pesan lama'}
                  </button>
                </div>
              )}
              {msgs.map(m => (
                <div key={m.id} className="msg-row" data-mid={m.wa_message_id || ''} style={{ display: 'flex', justifyContent: m.direction === 'in' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      padding: '9px 13px', borderRadius: 10,
                      fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                      background: m.direction === 'in' ? '#fff' : m.sender === 'ai' ? '#F0FDF4' : '#0D0D0D',
                      color: m.direction === 'in' ? '#0D0D0D' : m.sender === 'ai' ? '#14532D' : '#fff',
                      border: m.direction === 'in' ? '1px solid #E5E5E5' : m.sender === 'ai' ? '1px solid #BBF7D0' : 'none',
                      opacity: m.status === 'sending' ? 0.6 : 1,
                    }}>
                      {m.sender === 'ai' && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', marginBottom: 3, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="#16A34A"/></svg>
                          AIRA AI
                        </div>
                      )}
                      {m.quoted && (
                        <div onClick={() => m.reply_to && scrollToMessage(m.reply_to)} style={{
                          borderLeft: `3px solid ${m.direction === 'out' && m.sender !== 'ai' ? 'rgba(255,255,255,0.6)' : '#16A34A'}`,
                          background: m.direction === 'out' && m.sender !== 'ai' ? 'rgba(255,255,255,0.14)' : '#F0FDF4',
                          borderRadius: 6, padding: '5px 9px', marginBottom: 5, maxWidth: '100%',
                          cursor: m.reply_to ? 'pointer' : 'default',
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 1, opacity: 0.85, color: m.direction === 'out' && m.sender !== 'ai' ? '#fff' : '#15803D' }}>
                            {m.quoted.direction === 'in' ? 'Customer' : 'Kamu'}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                            {m.quoted.body ? m.quoted.body : (m.quoted.is_media ? '📎 Lampiran' : 'Pesan')}
                          </div>
                        </div>
                      )}
                      {m.is_forwarded && (
                        <div style={{ fontSize: 10, fontStyle: 'italic', opacity: 0.6, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Diteruskan
                        </div>
                      )}
                      {(m.media_url || (m.type && m.type !== 'text' && m.type !== 'button' && m.type !== 'interactive')) && (
                        <div style={{ marginBottom: m.body ? 6 : 0 }}>
                          <MediaBubble m={m} light={m.direction === 'out' && m.sender !== 'ai'} onOpen={setViewer} />
                        </div>
                      )}
                      {m.body}
                    </div>
                    <div className="msg-actions" style={{ display: 'flex', gap: 10, marginTop: 3, justifyContent: m.direction === 'in' ? 'flex-start' : 'flex-end', paddingLeft: 2, paddingRight: 2 }}>
                      <button onClick={() => setReplyingTo(m)}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 3H8a2.5 2.5 0 010 5H4M6 3L4 1M6 3L4 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Balas
                      </button>
                      <button onClick={() => { setForwardPick(m); setForwardSearch(''); }}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 9H4a2.5 2.5 0 010-5h4M6 9l2 2M6 9l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Teruskan
                      </button>
                    </div>
                    {m.direction === 'out' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3, paddingRight: 2 }}>
                        <StatusIcon status={m.status} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Quick Reply Picker */}
            {showQR && filteredQR.length > 0 && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 14, right: 14, background: '#fff', border: '1px solid #E5E5E5', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', zIndex: 10 }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Quick Replies ({filteredQR.length})</div>
                  {filteredQR.map(qr => (
                    <div key={qr.id} onClick={() => applyQuickReply(qr)} style={{ padding: '10px 12px', borderBottom: '1px solid #F7F7F7', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D' }}>{qr.title}</div>
                        <code style={{ fontSize: 10, padding: '1px 5px', background: '#F0FDF4', color: '#16A34A', borderRadius: 3, fontFamily: 'monospace' }}>/{qr.shortcut}</code>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{qr.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIEW sebelum kirim */}
            {pending && (
              <div style={{ padding: '12px 14px', background: '#FAFAFA', borderTop: '1px solid #E5E5E5' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {pending.isImage ? (
                    <img src={pending.url} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E5E5', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #E5E5E5', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 26 }}>📄</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pending.file.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 7 }}>{(pending.file.size / 1024).toFixed(0)} KB</div>
                    <input
                      value={caption} onChange={e => setCaption(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendPending() } if (e.key === 'Escape') cancelPending() }}
                      placeholder="Tambah caption (opsional)…" autoFocus
                      style={{ width: '100%', padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0D0D0D', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                  <button onClick={cancelPending} disabled={sendingMedia}
                    style={{ padding: '8px 14px', borderRadius: 7, background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
                  <button onClick={sendPending} disabled={sendingMedia}
                    style={{ padding: '8px 18px', borderRadius: 7, background: sendingMedia ? '#F0F0F0' : '#0D0D0D', color: sendingMedia ? '#9CA3AF' : '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: sendingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {sendingMedia ? 'Mengirim…' : 'Kirim'}
                  </button>
                </div>
              </div>
            )}

            {/* Kirim lokasi */}
            {showLoc && (
              <div style={{ padding: '12px 14px', background: '#FAFAFA', borderTop: '1px solid #E5E5E5' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0D0D0D', marginBottom: 8 }}>Kirim Lokasi</div>
                {locErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 11, borderRadius: 6, padding: '7px 9px', marginBottom: 8 }}>{locErr}</div>}
                <button onClick={useMyLocation} disabled={locBusy}
                  style={{ padding: '7px 12px', borderRadius: 7, background: '#fff', color: '#16A34A', border: '1px solid #BBF7D0', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
                  📍 Pakai lokasi saya sekarang
                </button>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={locForm.latitude} onChange={e => setLocForm({ ...locForm, latitude: e.target.value })} placeholder="Latitude (-6.2088)"
                    style={{ flex: 1, padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0D0D0D', boxSizing: 'border-box' }} />
                  <input value={locForm.longitude} onChange={e => setLocForm({ ...locForm, longitude: e.target.value })} placeholder="Longitude (106.8456)"
                    style={{ flex: 1, padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0D0D0D', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} placeholder="Nama tempat (opsional)"
                    style={{ flex: 1, padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0D0D0D', boxSizing: 'border-box' }} />
                  <input value={locForm.address} onChange={e => setLocForm({ ...locForm, address: e.target.value })} placeholder="Alamat (opsional)"
                    style={{ flex: 1, padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#0D0D0D', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowLoc(false); setLocErr(null) }}
                    style={{ padding: '8px 14px', borderRadius: 7, background: '#fff', color: '#6B7280', border: '1px solid #E5E5E5', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
                  <button onClick={sendLocationMsg} disabled={locBusy}
                    style={{ padding: '8px 18px', borderRadius: 7, background: locBusy ? '#F0F0F0' : '#0D0D0D', color: locBusy ? '#9CA3AF' : '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: locBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {locBusy ? 'Mengirim…' : 'Kirim Lokasi'}
                  </button>
                </div>
              </div>
            )}

            {showEmoji && (
              <div style={{ background: '#fff', borderTop: '1px solid #E5E5E5' }}>
                <div style={{ padding: '10px 12px 8px' }}>
                  <input value={emojiSearch} onChange={e => setEmojiSearch(e.target.value)} placeholder="Cari emoji…"
                    style={{ width: '100%', padding: '8px 11px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#F7F7F7', boxSizing: 'border-box' }} />
                </div>
                <div style={{ maxHeight: 244, overflowY: 'auto', padding: '0 8px 10px' }}>
                  {emojiSearch.trim() ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)' }}>
                      {EMOJIS.map((em, i) => (
                        <button key={em + i} onClick={() => setText(t => t + em)}
                          style={{ aspectRatio: '1', fontSize: 23, lineHeight: 1, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F0F0F0')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          {em}
                        </button>
                      ))}
                    </div>
                  ) : (
                    EMOJI_CATEGORIES.map(cat => (
                      <div key={cat.key}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 4px 4px' }}>{cat.key}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)' }}>
                          {cat.emojis.map((em, i) => (
                            <button key={em + i} onClick={() => setText(t => t + em)}
                              style={{ aspectRatio: '1', fontSize: 23, lineHeight: 1, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0F0F0')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {replyingTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: '#F0FDF4', borderTop: '1px solid #E5E5E5', borderLeft: '3px solid #16A34A' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#15803D', marginBottom: 1 }}>
                    Membalas {replyingTo.direction === 'in' ? 'customer' : 'diri sendiri'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {replyingTo.body || (replyingTo.media_mime ? '📎 Lampiran' : 'Pesan')}
                  </div>
                </div>
                <button onClick={() => setReplyingTo(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
              </div>
            )}

            <div style={{ padding: '10px 14px', background: '#fff', borderTop: '1px solid #E5E5E5', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={() => setShowEmoji(v => !v)} title="Emoji"
                style={{ padding: '9px 10px', borderRadius: 7, background: showEmoji ? '#F0FDF4' : '#F7F7F7', border: `1px solid ${showEmoji ? '#BBF7D0' : '#E5E5E5'}`, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 15, lineHeight: 1 }}>
                😊
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={sendingMedia} title="Kirim foto / dokumen"
                style={{ padding: '9px 10px', borderRadius: 7, background: '#F7F7F7', border: '1px solid #E5E5E5', cursor: sendingMedia ? 'wait' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', color: '#6B7280' }}>
                {sendingMedia
                  ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#D4D4D4" strokeWidth="2"/><path d="M8 2a6 6 0 016 6" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.7s" repeatCount="indefinite"/></path></svg>
                  : <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M14 7.5l-6 6a3.5 3.5 0 01-5-5l6.5-6.5a2.3 2.3 0 013.3 3.3L6.5 11.5a1.1 1.1 0 01-1.6-1.6L11 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <button onClick={() => { setShowLoc(v => !v); setLocErr(null) }} title="Kirim lokasi"
                style={{ padding: '9px 10px', borderRadius: 7, background: showLoc ? '#F0FDF4' : '#F7F7F7', border: `1px solid ${showLoc ? '#BBF7D0' : '#E5E5E5'}`, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', color: showLoc ? '#16A34A' : '#6B7280' }}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M8.5 15.5s5.5-4.6 5.5-8.8a5.5 5.5 0 10-11 0c0 4.2 5.5 8.8 5.5 8.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="8.5" cy="6.7" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
              </button>
              <textarea
                value={text} onChange={e => handleTextChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } if (e.key === 'Escape') setShowQR(false) }}
                placeholder="Tulis balasan… (Enter kirim · / untuk quick reply)"
                rows={1}
                style={{ flex: 1, padding: '9px 12px', resize: 'none', border: '1px solid #E5E5E5', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#F7F7F7', color: '#0D0D0D', lineHeight: 1.5 }}
              />
              <button onClick={send} disabled={sending || !text.trim()}
                style={{ padding: '9px 16px', borderRadius: 7, background: sending || !text.trim() ? '#F0F0F0' : '#0D0D0D', color: sending || !text.trim() ? '#9CA3AF' : '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: sending || !text.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                {sending ? '…' : 'Kirim'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT: CRM PANEL */}
      <div className="inbox-right" style={{ width: 300, background: '#fff', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <button onClick={() => setShowInfoMobile(false)} className="inbox-mobile-only" style={{ alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: '1px solid #E5E5E5', cursor: 'pointer', padding: '10px 14px', color: '#6B7280', fontSize: 13, fontFamily: 'inherit' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12.5 5L7.5 10l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Kembali ke chat
        </button>
        {!active ? (
          <div style={{ padding: '32px 16px', fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
            Pilih percakapan untuk melihat detail kontak.
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E5' }}>
              <button onClick={() => setRightTab('contact')} style={{
                flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 500, background: 'none', border: 'none',
                color: rightTab === 'contact' ? '#0D0D0D' : '#9CA3AF',
                borderBottom: rightTab === 'contact' ? '2px solid #16A34A' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
              }}>Detail Kontak</button>
              <button onClick={() => { setRightTab('copilot'); if (!copilot && active) loadCopilot(active.id) }} style={{
                flex: 1, padding: '11px 0', fontSize: 12, fontWeight: 500, background: 'none', border: 'none',
                color: rightTab === 'copilot' ? '#0D0D0D' : '#9CA3AF',
                borderBottom: rightTab === 'copilot' ? '2px solid #16A34A' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill={rightTab === 'copilot' ? '#16A34A' : '#9CA3AF'}/></svg>
                AI Copilot
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {rightTab === 'contact' && contactDetail && (
                <>
                  {/* Contact header */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
                    <Avatar name={contactDetail.contact.name || contactDetail.contact.phone} size={56} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0D0D0D', marginTop: 10 }}>{contactDetail.contact.name || 'Belum ada nama'}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{contactDetail.contact.phone}</div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    <div style={{ padding: '8px 10px', background: '#F7F7F7', borderRadius: 7, border: '1px solid #E5E5E5' }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, letterSpacing: 0.5 }}>PESAN MASUK</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0D0D0D' }}>{contactDetail.stats.total_messages_in}</div>
                    </div>
                    <div style={{ padding: '8px 10px', background: '#F7F7F7', borderRadius: 7, border: '1px solid #E5E5E5' }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, letterSpacing: 0.5 }}>BALAS</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0D0D0D' }}>{contactDetail.stats.total_messages_out}</div>
                    </div>
                  </div>

                  {/* Last order info */}
                  {contactDetail.stats.days_since_last_order !== null && (
                    <div style={{ padding: '10px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: '#15803D', fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>ORDER TERAKHIR</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>{contactDetail.stats.days_since_last_order} hari yang lalu</div>
                    </div>
                  )}

                  <button onClick={markOrder} style={{ width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 500, background: '#fff', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
                    ✓ Tandai kontak ini baru order
                  </button>

                  {/* Tags */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.5 }}>TAGS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                      {(contactDetail.contact.tags || []).map((t: string) => (
                        <span key={t} style={{ fontSize: 11, padding: '3px 7px', background: '#F0FDF4', color: '#15803D', borderRadius: 4, border: '1px solid #BBF7D0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {t}
                          <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: '#15803D', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="+ tag baru" style={{ flex: 1, padding: '5px 8px', fontSize: 11, border: '1px solid #E5E5E5', borderRadius: 5, outline: 'none', background: '#fff', color: '#0D0D0D', fontFamily: 'inherit' }} />
                      <button onClick={addTag} disabled={!newTag.trim()} style={{ padding: '5px 10px', fontSize: 11, background: !newTag.trim() ? '#F0F0F0' : '#0D0D0D', color: !newTag.trim() ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 5, cursor: !newTag.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Add</button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: 0.5 }}>CATATAN INTERNAL</div>
                      {notesDraft !== (contactDetail.contact.notes || '') && (
                        <button onClick={saveNotes} disabled={savingNotes} style={{ fontSize: 11, color: '#16A34A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                          {savingNotes ? 'Menyimpan…' : 'Simpan'}
                        </button>
                      )}
                    </div>
                    <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder="Catatan tentang kontak ini. Hanya tim kamu yang lihat." rows={5} style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #E5E5E5', borderRadius: 7, outline: 'none', resize: 'vertical', background: '#FAFAFA', fontFamily: 'inherit', color: '#0D0D0D', boxSizing: 'border-box', lineHeight: 1.5 }} />
                  </div>
                </>
              )}

              {rightTab === 'copilot' && (
                <>
                  <button onClick={() => loadCopilot(active.id)} style={{ width: '100%', padding: '7px 0', fontSize: 11, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, marginBottom: 14 }}>
                    {coLoading ? 'Memuat…' : 'Refresh saran AI'}
                  </button>
                  {coLoading ? (
                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Membaca percakapan…</div>
                  ) : !copilot ? (
                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Klik refresh untuk dapat saran.</div>
                  ) : (
                    <>
                      {copilot.intent && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 6 }}>MAKSUD CUSTOMER</div>
                          <div style={{ fontSize: 12, color: '#374151', background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>{copilot.intent}</div>
                        </div>
                      )}
                      {copilot.suggestion && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 6 }}>SARAN BALASAN</div>
                          <div style={{ fontSize: 12, color: '#14532D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{copilot.suggestion}</div>
                          <button onClick={() => setText(copilot.suggestion)} style={{ width: '100%', padding: '7px 0', background: '#0D0D0D', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                            Pakai saran ini
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
