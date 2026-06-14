import React, { useState, useEffect } from 'react';
import { 
  Search, ChevronDown, ChevronRight, 
  Target, Layers, 
  Download, ChevronLeft, ChevronRight as ChevronRightIcon,
  MapPin, IndianRupee, Maximize2, RotateCcw, Home,
  ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Clock3, MessageSquareText, Radio
} from 'lucide-react';
import { matchService, type DashboardResponse } from '../services/api';
import { format } from 'date-fns';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { pageUi } from '../lib/pageUi';
import * as XLSX from 'xlsx';

type SortDirection = 'asc' | 'desc';
type SortKey =
  | 'scorePercent'
  | 'matchQuality'
  | 'property.location'
  | 'property.price'
  | 'buyer.budget'
  | null;

const DashboardPage: React.FC = () => {
  const initialFilters = {
    startDate: '',
    endDate: '',
    listingType: [] as string[],
    requirementType: [] as string[],
    matchStatus: [] as string[],
    tier: [] as string[],
    brokerName: '',
    locations: [] as string[],
    minPrice: '',
    maxPrice: '',
    minBudget: '',
    maxBudget: '',
    searchText: '',
  };

  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('scorePercent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const LISTING_TYPE_OPTIONS = ['SELL', 'RENT', 'LEASE'];
  const REQUIREMENT_TYPE_OPTIONS = ['BUY', 'RENT'];
  const MATCH_STATUS_OPTIONS = ['MATCHED', 'PENDING_CONFIRMATION', 'CONFIRMED'];

  const locationOptions = (() => {
    const matches = (data?.matches ?? []) as any[];
    const set = new Set<string>();
    for (const m of matches) {
      const loc = String(m?.property?.location ?? '').trim();
      if (loc) set.add(loc);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await matchService.searchMatches(filters, page, pageSize);
      setData(response.data);
    } catch {
      setError('Failed to fetch data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  useEffect(() => {
    handleSearch();
  }, [page, filters.listingType, filters.requirementType, filters.matchStatus, filters.tier, pageSize]);

  const toggleFilterValue = (filterKey: 'listingType' | 'requirementType' | 'matchStatus', value: string) => {
    setExpandedRow(null);
    setFilters((prev) => {
      const current = prev[filterKey];
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [filterKey]: next };
    });
    setPage(1);
  };

  const toggleLocation = (value: string) => {
    setExpandedRow(null);
    setFilters((prev) => {
      const current = prev.locations;
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, locations: next };
    });
    setPage(1);
  };

  const parseAmount = (raw: any): number | null => {
    if (raw == null) return null;
    const s = String(raw);
    const digits = s.replace(/[^\d.]/g, '');
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  };

  const parseFilterNumber = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const getMatchField = (match: any, possiblePaths: string[]) => {
    for (const path of possiblePaths) {
      const val = path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), match);
      if (val != null && val !== '') return val;
    }
    return null;
  };

  const filteredMatches = (() => {
    const matches = (data?.matches ?? []) as any[];
    if (!matches.length) return matches;

    const minPrice = parseFilterNumber(filters.minPrice);
    const maxPrice = parseFilterNumber(filters.maxPrice);
    const minBudget = parseFilterNumber(filters.minBudget);
    const maxBudget = parseFilterNumber(filters.maxBudget);
    const search = filters.searchText.trim().toLowerCase();

    return matches.filter((m) => {
      // The current API returns human-readable strings like:
      // - property.for: "For Sale" / "For Rent"
      // - buyer.lookingFor: "Wants to Buy" / "Wants to Rent"
      const propertyFor = String(getMatchField(m, ['property.for', 'property.status', 'listingType', 'property.listingType']) ?? '');
      const buyerLookingFor = String(getMatchField(m, ['buyer.lookingFor', 'requirementType', 'buyer.requirementType']) ?? '');

      const normalize = (s: string) => s.trim().toUpperCase();
      const listingTypeRaw = normalize(propertyFor);
      const requirementTypeRaw = normalize(buyerLookingFor);

      const listingType =
        listingTypeRaw.includes('SALE') || listingTypeRaw.includes('SELL')
          ? 'SELL'
          : listingTypeRaw.includes('RENT')
            ? 'RENT'
            : listingTypeRaw.includes('LEASE')
              ? 'LEASE'
              : '';

      const requirementType =
        requirementTypeRaw.includes('BUY')
          ? 'BUY'
          : requirementTypeRaw.includes('RENT')
            ? 'RENT'
            : '';

      // matchStatus isn't present in current API response; do not filter by it unless backend provides it.
      const matchStatus = String(getMatchField(m, ['matchStatus', 'status']) ?? '').trim().toUpperCase();

      if (filters.listingType.length > 0 && (!listingType || !filters.listingType.includes(listingType))) return false;
      if (filters.requirementType.length > 0 && (!requirementType || !filters.requirementType.includes(requirementType))) return false;
      if (filters.matchStatus.length > 0 && matchStatus && !filters.matchStatus.includes(matchStatus)) return false;

      if (filters.locations.length > 0) {
        const propLoc = String(m?.property?.location ?? '').trim();
        if (!propLoc || !filters.locations.includes(propLoc)) return false;
      }

      if (minPrice != null || maxPrice != null) {
        const price = parseAmount(m?.property?.price);
        if (price == null) return false;
        if (minPrice != null && price < minPrice) return false;
        if (maxPrice != null && price > maxPrice) return false;
      }

      if (minBudget != null || maxBudget != null) {
        const budget = parseAmount(m?.buyer?.budget);
        if (budget == null) return false;
        if (minBudget != null && budget < minBudget) return false;
        if (maxBudget != null && budget > maxBudget) return false;
      }

      if (search) {
        const fields: string[] = [
          m?.matchQuality,
          m?.property?.for,
          m?.property?.type,
          m?.property?.config,
          m?.property?.location,
          m?.property?.city,
          m?.property?.price,
          m?.property?.size,
          m?.property?.brokerName,
          m?.buyer?.lookingFor,
          m?.buyer?.type,
          m?.buyer?.config,
          m?.buyer?.location,
          m?.buyer?.city,
          m?.buyer?.budget,
          m?.buyer?.brokerName,
          ...(m?.matchDetails ? Object.values(m.matchDetails) : []),
        ]
          .filter((v) => v != null)
          .map((v) => String(v).toLowerCase());

        if (!fields.some((v) => v.includes(search))) return false;
      }

      return true;
    });
  })();

  const hasMatchStatusField = Boolean(
    (data?.matches ?? []).some((m: any) => m?.matchStatus != null || m?.status != null)
  );

  const getSortableValue = (match: any, key: Exclude<SortKey, null>) => {
    const readPath = (obj: any, path: string) =>
      path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);

    const raw = readPath(match, key);
    if (raw == null) return null;

    if (key === 'scorePercent') return Number(raw);
    if (key === 'matchQuality') return String(raw).toLowerCase();

    if (key === 'property.price' || key === 'buyer.budget') {
      // Try to sort numerically even when values contain currency symbols/words.
      const n = Number(String(raw).replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : String(raw).toLowerCase();
    }

    return String(raw).toLowerCase();
  };

  const sortedMatches = (() => {
    const matches = filteredMatches as any[];
    if (!sortKey) return matches;

    return matches
      .map((m, i) => ({ m, i }))
      .sort((a, b) => {
        const av = getSortableValue(a.m, sortKey);
        const bv = getSortableValue(b.m, sortKey);

        if (av == null && bv == null) return a.i - b.i;
        if (av == null) return 1;
        if (bv == null) return -1;

        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDirection === 'asc' ? av - bv : bv - av;
        }

        const cmp = String(av).localeCompare(String(bv));
        return sortDirection === 'asc' ? cmp : -cmp;
      })
      .map(({ m }) => m);
  })();

  const toggleSort = (key: Exclude<SortKey, null>) => {
    setExpandedRow(null);
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDirection(key === 'scorePercent' ? 'desc' : 'asc');
        return key;
      }
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return prev;
    });
  };

  const exportToExcel = () => {
    if (!sortedMatches.length) return;

    const rows = sortedMatches.map((m: any) => ({
      'Score %': m.scorePercent ?? '',
      'Match Quality': m.matchQuality ?? '',
      'Property For': m?.property?.for ?? '',
      'Property Type': m?.property?.type ?? '',
      'Property Config': m?.property?.config ?? '',
      'Property Location': m?.property?.location ?? '',
      'Property City': m?.property?.city ?? '',
      'Property Price': m?.property?.price ?? '',
      'Property Size': m?.property?.size ?? '',
      'Property Broker': m?.property?.brokerName ?? '',
      'Property Broker Phone': m?.property?.brokerPhone ?? '',
      'Buyer Looking For': m?.buyer?.lookingFor ?? '',
      'Buyer Type': m?.buyer?.type ?? '',
      'Buyer Config': m?.buyer?.config ?? '',
      'Buyer Location': m?.buyer?.location ?? '',
      'Buyer City': m?.buyer?.city ?? '',
      'Buyer Budget': m?.buyer?.budget ?? '',
      'Buyer Size': m?.buyer?.size ?? '',
      'Buyer Broker': m?.buyer?.brokerName ?? '',
      'Buyer Broker Phone': m?.buyer?.brokerPhone ?? '',
      'Match Details': m?.matchDetails ? JSON.stringify(m.matchDetails) : '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });

    // Keep text as-is to avoid Excel auto-coercion (e.g. phone numbers, currency strings).
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        if (cell.t === 'n') {
          // Keep real numbers as numbers (score)
          continue;
        }
        cell.t = 's';
        cell.v = cell.v == null ? '' : String(cell.v);
      }
    }

    // Make header row bold-ish via column widths (simple UX improvement)
    ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 22 }));

    XLSX.utils.book_append_sheet(wb, ws, 'Matches');
    const fileName = `matches-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName, { compression: true });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className={`${pageUi.alertError} flex items-start gap-3`} role="alert">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {data && (
        <section className={pageUi.panel} aria-label="Dashboard response details">
          <div className={`${pageUi.panelBody} grid grid-cols-1 gap-5 md:grid-cols-3`}>
            <div className="flex items-start gap-3">
              <div className={pageUi.panelHeaderIconWrap}>
                <Radio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className={pageUi.label}>Source</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{data.source || '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={pageUi.panelHeaderIconWrap}>
                <MessageSquareText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className={pageUi.label}>Message</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{data.message || '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={pageUi.panelHeaderIconWrap}>
                <Clock3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className={pageUi.label}>Date &amp; Time</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-900">{data.dateTime || '-'}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter Section (Keeping the UI, but we mostly rely on pagination based on API limits) */}
      <section className={pageUi.panel}>
        <div className={`${pageUi.panelHeader} ${pageUi.panelHeaderMuted}`}>
          <div className={pageUi.panelHeaderIconWrap}>
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className={pageUi.cardTitle}>Filters</h2>
            <button type="button" onClick={resetFilters} className={`${pageUi.btnSecondary} w-full sm:w-auto`}>
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        <div className={`${pageUi.panelBody} grid grid-cols-1 md:grid-cols-12 gap-4 items-end`}>

          <div className="md:col-span-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={filters.searchText}
                onChange={(e) => {
                  setExpandedRow(null);
                  setFilters((p) => ({ ...p, searchText: e.target.value }));
                  setPage(1);
                }}
                placeholder="Search in loaded results..."
                className={`${pageUi.input} pl-9`}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <MultiSelectDropdown
              label="Listing Type"
              options={LISTING_TYPE_OPTIONS}
              selected={filters.listingType}
              onChange={(v) => toggleFilterValue('listingType', v)}
              placeholder="All"
            />
          </div>
          <div className="md:col-span-3">
            <MultiSelectDropdown
              label="Requirement Type"
              options={REQUIREMENT_TYPE_OPTIONS}
              selected={filters.requirementType}
              onChange={(v) => toggleFilterValue('requirementType', v)}
              placeholder="All"
            />
          </div>
          <div className="md:col-span-2">
            <MultiSelectDropdown
              label="Match Status"
              options={MATCH_STATUS_OPTIONS}
              selected={filters.matchStatus}
              onChange={(v) => toggleFilterValue('matchStatus', v)}
              placeholder="All"
              disabled={!hasMatchStatusField}
            />
          </div>

          <div className="md:col-span-4">
            <MultiSelectDropdown
              label="Location"
              options={locationOptions}
              selected={filters.locations}
              onChange={toggleLocation}
              placeholder={locationOptions.length ? 'All' : 'No locations'}
              disabled={locationOptions.length === 0}
            />
          </div>


          <div className="md:col-span-4">
            <label className={pageUi.labelBlock}>Budget Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={filters.minBudget}
                onChange={(e) => setFilters((p) => ({ ...p, minBudget: e.target.value }))}
                placeholder="Min budget"
                inputMode="numeric"
                className={pageUi.input}
              />
              <input
                value={filters.maxBudget}
                onChange={(e) => setFilters((p) => ({ ...p, maxBudget: e.target.value }))}
                placeholder="Max budget"
                inputMode="numeric"
                className={pageUi.input}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Results Table */}
      <div className={pageUi.panel}>
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className={pageUi.title}>Match Results</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
                Showing <span className="mx-1 text-slate-900">{sortedMatches.length}</span> of{' '}
                <span className="ml-1 text-slate-900">{(data?.matches?.length ?? 0) as number}</span> loaded
              </span>
              {data?.pagination?.totalMatches != null && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-primary-50 text-primary-700 border border-primary-100">
                  Total matches: <span className="ml-1 text-primary-900">{data.pagination.totalMatches}</span>
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={exportToExcel} className={`${pageUi.btnPrimary} w-full md:w-auto`}>
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 z-[1] bg-gradient-to-b from-slate-50 to-white text-slate-500 text-[10px] font-black uppercase tracking-[0.12em] border-b border-slate-100">
                <th className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('scorePercent')}
                    className="group inline-flex items-center gap-2 hover:text-slate-700 transition-colors"
                    title="Sort by score"
                  >
                    Score & Quality
                    {sortKey === 'scorePercent' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('property.location')}
                    className="group inline-flex items-center gap-2 hover:text-slate-700 transition-colors"
                    title="Sort by property location"
                  >
                    Property
                    {sortKey === 'property.location' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('buyer.budget')}
                    className="group inline-flex items-center gap-2 hover:text-slate-700 transition-colors"
                    title="Sort by buyer budget"
                  >
                    Buyer Requirement
                    {sortKey === 'buyer.budget' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">Match Details</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <AnimatedLoader />
              ) : sortedMatches.length > 0 ? (
                sortedMatches.map((match: any, idx: number) => (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-lg font-black text-slate-900 tracking-tight">{match.scorePercent}%</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded w-max mt-1 ${
                            match.scorePercent > 80 ? 'bg-emerald-50 text-emerald-600' :
                            match.scorePercent > 60 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
                          }`}>
                            {match.matchQuality}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center text-slate-900 font-bold">
                            <Home className="w-3 h-3 mr-1 text-slate-400" /> {match.property.type} - {match.property.config}
                          </div>
                          <div className="flex items-center text-slate-900 font-bold">
                            <MapPin className="w-3 h-3 mr-1 text-slate-400" /> {match.property.location}
                          </div>
                          <div className="flex items-center text-slate-500 text-xs font-medium">
                            <IndianRupee className="w-3 h-3 mr-1" /> {match.property.price} • <Maximize2 className="w-3 h-3 mx-1" /> {match.property.size}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm space-y-1">
                        <div className="flex items-center text-slate-900 font-bold">
                          <Target className="w-3 h-3 mr-1 text-slate-400" /> {match.buyer.lookingFor} ({match.buyer.type})
                        </div>
                        <div className="flex items-center text-slate-900 font-bold">
                          <IndianRupee className="w-3 h-3 mr-1" /> {match.buyer.budget}
                        </div>
                        <div className="text-slate-500 text-xs mt-1 truncate max-w-[200px] font-medium">
                          {match.buyer.location}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600">
                           <ul className="list-disc pl-4">
                             {Object.entries(match.matchDetails || {}).map(([key, val]) => (
                               <li key={key} className="truncate capitalize">{key}: {val as React.ReactNode}</li>
                             ))}
                           </ul>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                          className="p-2 hover:bg-slate-100 rounded-xl transition-colors group"
                        >
                          {expandedRow === idx ? (
                            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-primary-600" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === idx && (
                      <tr className="bg-slate-50/30 border-l-4 border-primary-500 animate-in slide-in-from-left-1 duration-200">
                        <td colSpan={5} className="px-6 py-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                            <div>
                               <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Property Broker</h3>
                               <div className="space-y-2">
                                 <p className="text-sm"><span className="text-slate-400 font-medium">Name:</span> <strong>{match.property.brokerName}</strong></p>
                                 <p className="text-sm"><span className="text-slate-400 font-medium">Phone:</span> <strong>{match.property.brokerPhone}</strong></p>
                                 <p className="text-sm"><span className="text-slate-400 font-medium">Status:</span> <strong>{match.property.for}</strong></p>
                               </div>
                            </div>
                            <div>
                               <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Buyer Broker</h3>
                               <div className="space-y-2">
                                 <p className="text-sm"><span className="text-slate-400 font-medium">Name:</span> <strong>{match.buyer.brokerName}</strong></p>
                                 <p className="text-sm"><span className="text-slate-400 font-medium">Phone:</span> <strong>{match.buyer.brokerPhone}</strong></p>
                               </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <Layers className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-lg font-bold text-slate-800">No matches found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination / Table Footer */}
        {data?.pagination && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-slate-500 font-bold">
                Page <span className="text-slate-900">{data.pagination.currentPage}</span> of <span className="text-slate-900">{data.pagination.totalPages}</span>
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium flex items-center">
                Total Matches: <span className="text-slate-600 mx-1">{data.pagination.totalMatches}</span> • 
                <span className="ml-2 mr-1">Rows per page:</span>
                <select 
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className={`${pageUi.selectSm} mx-1`}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </span>
            </div>
            <div className="flex space-x-2">
              <button 
                disabled={data.pagination.currentPage === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="flex items-center justify-center px-4 py-2 border border-slate-200 rounded-xl bg-white hover:border-primary-400 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm text-sm font-bold text-slate-600"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </button>
              <button 
                disabled={data.pagination.currentPage === data.pagination.totalPages}
                onClick={() => setPage(p => Math.min(data.pagination?.totalPages ?? p, p + 1))}
                className="flex items-center justify-center px-4 py-2 border border-slate-200 rounded-xl bg-white hover:border-primary-400 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm text-sm font-bold text-slate-600"
              >
                Next
                <ChevronRightIcon className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AnimatedLoader = () => (
  <tr>
    <td colSpan={5} className="py-32">
      <div className="flex flex-col items-center justify-center space-y-8">
        <div className="relative flex items-center justify-center w-24 h-24">
          {/* Pulsing rings */}
          <div className="absolute inset-0 bg-primary-100 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-75"></div>
          <div className="absolute inset-4 bg-primary-200 rounded-full animate-pulse duration-700"></div>
          
          {/* Bouncing core */}
          <div className="relative bg-white rounded-full p-4 shadow-xl border border-slate-100 flex items-center justify-center z-10 animate-bounce duration-1000 shadow-primary-500/20">
            <Home className="w-8 h-8 text-primary-600" />
          </div>
          
          {/* Sweeping radar/search element */}
          <Search className="w-6 h-6 text-amber-500 absolute bottom-0 right-0 z-20 animate-[spin_3s_linear_infinite]" />
        </div>
        
        <div className="flex flex-col items-center space-y-1.5 animate-pulse">
          <h3 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-indigo-500 to-primary-600 bg-[length:200%_auto] animate-[gradient_2s_linear_infinite]">
            Discovering Perfect Matches
          </h3>
          <p className="text-sm text-slate-500 font-bold tracking-wide">
            Analyzing properties and requirements...
          </p>
        </div>
      </div>
    </td>
  </tr>
);

export default DashboardPage;
