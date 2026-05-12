/**
 * Shared Tailwind classes so Dashboard, Upload, and Add Property stay visually aligned.
 */
export const pageUi = {
  panel: 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden',
  panelHeader: 'px-6 py-5 border-b border-slate-100 flex items-center gap-3',
  panelHeaderMuted: 'bg-slate-50/80',
  panelHeaderIconWrap: 'w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center shrink-0',
  panelBody: 'p-6',
  panelBodyLg: 'p-8',

  title: 'text-xl font-black text-slate-900 tracking-tight',
  subtitle: 'text-sm text-slate-500 mt-1',
  /** Card / panel title (no underline). */
  cardTitle: 'text-lg font-bold text-slate-800 tracking-tight',
  sectionTitle: 'text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4',

  /** Inline with MultiSelect (parent supplies vertical spacing). */
  label: 'text-xs font-bold text-slate-500 uppercase tracking-wider ml-1',
  /** Standalone field label above input/select/textarea. */
  labelBlock: 'block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1.5',

  input:
    'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none transition-colors hover:border-primary-400 focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
  textarea:
    'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none transition-colors hover:border-primary-400 focus:ring-2 focus:ring-primary-500/20 min-h-[120px] resize-y disabled:bg-slate-50 disabled:text-slate-400',

  /** Compact select (e.g. table footer page size). */
  selectSm:
    'bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-700 outline-none transition-colors hover:border-primary-400 focus:ring-2 focus:ring-primary-500/20',

  btnPrimary:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-black shadow-lg shadow-primary-600/25 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600 shadow-sm hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',

  alertError: 'rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 text-sm',
  alertSuccess: 'rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm',

  dropzone:
    'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all',
  dropzoneIdle: 'border-slate-200 hover:border-primary-400 hover:bg-primary-50/30',
  dropzoneActive: 'border-primary-500 bg-primary-50/40',

  btnIconGhost: 'p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors',
} as const;
