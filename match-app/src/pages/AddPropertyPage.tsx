import React, { useState } from 'react';
import { Building, RotateCcw, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { matchService } from '../services/api';
import { pageUi } from '../lib/pageUi';

function formatDateDDMMYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

type IndianMobileResult =
  | { ok: true; digits10: string }
  | { ok: false; message: string };

/**
 * Indian mobile: exactly 10 digits, first digit 6–9.
 * Accepts optional country code +91 / 0091 / 91 prefix and spaces or dashes.
 */
function parseIndianMobile(raw: string): IndianMobileResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Contact number is required.' };
  }

  let digits = trimmed.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  if (digits.startsWith('0091')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^\d{10}$/.test(digits)) {
    return {
      ok: false,
      message:
        'Enter a valid Indian mobile: 10 digits starting with 6–9, or +91 followed by those 10 digits.',
    };
  }

  if (!/^[6-9]/.test(digits)) {
    return {
      ok: false,
      message: 'Indian mobile numbers must be 10 digits and start with 6, 7, 8, or 9.',
    };
  }

  return { ok: true, digits10: digits };
}

const REQUIRED_FIELD_KEYS = ['SenderName', 'ContactNumber', 'Location', 'PropertyType'] as const;
type RequiredFieldKey = (typeof REQUIRED_FIELD_KEYS)[number];

function isRequiredFieldKey(name: string): name is RequiredFieldKey {
  return (REQUIRED_FIELD_KEYS as readonly string[]).includes(name);
}

const LISTING_TYPE_OPTIONS = [
  { value: 'FOR_SALE', label: 'For Sale' },
  { value: 'FOR_RENT', label: 'For Rent' },
  { value: 'REQUIREMENT', label: 'Requirement (Looking for Buy/Rent)' },
] as const;

const PROPERTY_TYPE_OPTIONS = [
  'Plot',
  'Flat / Apartment',
  'Land',
  'Villa',
  'House',
  'Independent House',
  'Independent Floor',
  'Duplex',
  'Bungalow',
  'Row House',
  'Farm House',
  'Penthouse',
  'Studio',
  'Shop',
  'Showroom',
  'Office',
  'Godown',
  'Warehouse',
  'Hotel',
] as const;

const CONFIGURATION_OPTIONS = [
  '1RK',
  '1BHK',
  '2BHK',
  '3BHK',
  '4BHK',
  '5BHK',
  '6BHK',
  '6+BHK',
] as const;

const SIZE_UNIT_OPTIONS = ['Sq Ft', 'Sq Yd', 'Sq M', 'Acre', 'Hectare'] as const;

const PRICE_UNIT_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'TOTAL', label: 'Total' },
  { value: 'PER_SQFT', label: 'Per Sqft' },
] as const;

const PRICE_DENOM_OPTIONS = [
  { value: 'K', label: 'Thousand (K)', multiplier: 1_000 },
  { value: 'L', label: 'Lakh (L)', multiplier: 1_00_000 },
  { value: 'Cr', label: 'Crore (Cr)', multiplier: 1_00_00_000 },
] as const;

type PriceDenom = (typeof PRICE_DENOM_OPTIONS)[number]['value'];

function priceToRupees(amount: string, denom: PriceDenom): number | null {
  const n = parseFloat(amount);
  if (!isFinite(n) || isNaN(n)) return null;
  const opt = PRICE_DENOM_OPTIONS.find((o) => o.value === denom);
  return opt ? n * opt.multiplier : null;
}

const FACING_OPTIONS = [
  'Not specified',
  'North',
  'South',
  'East',
  'West',
  'North-East',
  'North-West',
  'South-East',
  'South-West',
  'North & East',
  'North & West',
  'South & East',
  'South & West',
  'East-West',
  'North-South',
] as const;

const FURNISHING_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'FURNISHED', label: 'Furnished' },
  { value: 'SEMI_FURNISHED', label: 'SemiFurnished' },
  { value: 'UNFURNISHED', label: 'UnFurnished' },
] as const;

const initialForm = {
  SenderName: '',
  ContactNumber: '',
  ContactName: '',
  MessageDate: formatDateDDMMYY(new Date()),
  ListingType: 'FOR_SALE',
  PropertyType: '',
  Configuration: '',
  Location: '',
  ProjectName: '',
  Size: '',
  SizeUnit: 'Sq Ft',
  Size2: '',
  Width: '',
  Length: '',
  /** Raw numeric string entered by the user (e.g. "2.5") */
  PriceAmount: '',
  /** Denomination for display: K | L | Cr (default Lakh) */
  PriceDenom: 'L' as PriceDenom,
  PriceUnit: '',
  PricePerUnit: '',
  Facing: '',
  Furnishing: '',
  RoadLandmark: '',
  Description: '',
};

/** Maps form state to POST .../listing body (camelCase field names). */
function buildListingRequestBody(
  formData: typeof initialForm,
  messageDate: string,
  contactNameResolved: string,
  /** Normalized 10-digit Indian mobile (no country code). */
  contactNumber10: string,
): Record<string, unknown> {
  const num = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const emptyToNull = (s: string) => {
    const t = s.trim();
    return t === '' ? null : t;
  };

  const priceInRupees = priceToRupees(formData.PriceAmount, formData.PriceDenom);

  return {
    senderName: emptyToNull(formData.SenderName),
    contactNumber: contactNumber10,
    contactName: contactNameResolved.trim() || emptyToNull(formData.SenderName),
    messageDate,
    listingType: formData.ListingType,
    propertyType: emptyToNull(formData.PropertyType),
    configuration: formData.Configuration.trim() === '' ? null : formData.Configuration.trim(),
    location: emptyToNull(formData.Location),
    projectName: emptyToNull(formData.ProjectName),
    size: num(formData.Size),
    sizeUnit: formData.SizeUnit,
    size2: num(formData.Size2),
    width: num(formData.Width),
    length: num(formData.Length),
    price: priceInRupees,
    priceUnit: formData.PriceUnit.trim() === '' ? null : formData.PriceUnit.trim(),
    pricePerUnit: num(formData.PricePerUnit),
    facing: emptyToNull(formData.Facing),
    furnishing: formData.Furnishing.trim() === '' ? null : formData.Furnishing.trim(),
    roadLandmark: emptyToNull(formData.RoadLandmark),
    description: emptyToNull(formData.Description),
  };
}

const fieldErrorRing = 'border-rose-400 ring-2 ring-rose-500/20 focus:border-rose-500 focus:ring-rose-500/25';

const AddPropertyPage: React.FC = () => {
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RequiredFieldKey, string>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSubmitError(null);
    setSubmitSuccess(null);
    if (isRequiredFieldKey(name)) {
      setFieldErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleReset = () => {
    setFormData(initialForm);
    setSubmitError(null);
    setSubmitSuccess(null);
    setFieldErrors({});
  };

  const validateRequiredFields = (): { ok: false; errors: Partial<Record<RequiredFieldKey, string>> } | { ok: true; contactDigits10: string } => {
    const errors: Partial<Record<RequiredFieldKey, string>> = {};

    if (!formData.SenderName.trim()) {
      errors.SenderName = 'Sender name is required.';
    }

    const mobile = parseIndianMobile(formData.ContactNumber);
    if (mobile.ok === false) {
      errors.ContactNumber = mobile.message;
    }

    if (!formData.Location.trim()) {
      errors.Location = 'Location is required.';
    }

    if (!formData.PropertyType.trim()) {
      errors.PropertyType = 'Property type is required. Please select one from the list.';
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    if (mobile.ok === false) {
      return { ok: false, errors: { ContactNumber: mobile.message } };
    }

    return { ok: true, contactDigits10: mobile.digits10 };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const validated = validateRequiredFields();
    switch (validated.ok) {
      case true: {
        const messageDate = formData.MessageDate.trim() || formatDateDDMMYY(new Date());
        const contactName = formData.ContactName.trim() || formData.SenderName.trim();
        const payload = buildListingRequestBody(formData, messageDate, contactName, validated.contactDigits10);

        setSubmitting(true);
        try {
          const { data } = await matchService.submitListing(payload);
          console.log('Listing submitted:', data);
          setSubmitSuccess('Listing submitted successfully.');
          setFieldErrors({});
        } catch (err) {
          let message = 'Failed to submit listing. Please try again.';
          if (axios.isAxiosError(err)) {
            const data = err.response?.data as { message?: string; error?: string } | string | undefined;
            if (typeof data === 'string' && data) message = data;
            else if (data && typeof data === 'object') {
              message = data.message || data.error || JSON.stringify(data);
            } else if (err.message) message = err.message;
          }
          setSubmitError(message);
        } finally {
          setSubmitting(false);
        }
        break;
      }
      case false: {
        setFieldErrors(validated.errors);
        setSubmitError('Please fix the errors highlighted below before submitting.');
        break;
      }
    }
  };

  const controlClass = (key?: RequiredFieldKey) =>
    `${pageUi.input} ${key && fieldErrors[key] ? fieldErrorRing : ''}`;

  const FieldError = ({ field }: { field: RequiredFieldKey }) =>
    fieldErrors[field] ? (
      <p id={`${field}-error`} className="mt-1.5 text-xs font-semibold text-rose-600">
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className={pageUi.panel}>
        <div className={`${pageUi.panelHeader} ${pageUi.panelHeaderMuted}`}>
          <div className={pageUi.panelHeaderIconWrap}>
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className={pageUi.title}>Add Property Listing</h2>
            <p className={pageUi.subtitle}>Submit a property listing or requirement</p>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className={`${pageUi.panelBody} space-y-6`}>
          {submitError && (
            <div className={`${pageUi.alertError} flex items-start gap-3`} role="alert">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <span className="font-medium">{submitError}</span>
            </div>
          )}
          {submitSuccess && (
            <div className={`${pageUi.alertSuccess} flex items-start gap-3`} role="status">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <span className="font-medium">{submitSuccess}</span>
            </div>
          )}
          <div>
            <h3 className={pageUi.sectionTitle}>Contact / Sender Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={pageUi.labelBlock} htmlFor="SenderName">
                  Sender Name <span className="text-rose-600 font-black">*</span>
                </label>
                <input
                  id="SenderName"
                  type="text"
                  name="SenderName"
                  value={formData.SenderName}
                  onChange={handleChange}
                  placeholder="e.g. Gaurav Verma"
                  aria-required
                  aria-invalid={Boolean(fieldErrors.SenderName)}
                  aria-describedby={fieldErrors.SenderName ? 'SenderName-error' : undefined}
                  autoComplete="name"
                  className={controlClass('SenderName')}
                />
                <FieldError field="SenderName" />
              </div>
              <div>
                <label className={pageUi.labelBlock} htmlFor="ContactNumber">
                  Contact Number <span className="text-rose-600 font-black">*</span>
                </label>
                <input
                  id="ContactNumber"
                  type="tel"
                  name="ContactNumber"
                  value={formData.ContactNumber}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210 or +91 98765 43210"
                  aria-required
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldErrors.ContactNumber)}
                  aria-describedby={fieldErrors.ContactNumber ? 'ContactNumber-error' : undefined}
                  className={controlClass('ContactNumber')}
                />
                <FieldError field="ContactNumber" />
              </div>
              <div>
                <label className={pageUi.labelBlock}>Contact Name (if different)</label>
                <input
                  type="text"
                  name="ContactName"
                  value={formData.ContactName}
                  onChange={handleChange}
                  placeholder="Same as sender if blank"
                  className={pageUi.input}
                />
              </div>
              <div>
                <label className={pageUi.labelBlock}>Message Date</label>
                <input
                  type="text"
                  name="MessageDate"
                  value={formData.MessageDate}
                  onChange={handleChange}
                  placeholder="DD/MM/YY (auto-filled if blank)"
                  className={pageUi.input}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className={pageUi.sectionTitle}>Property Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={pageUi.labelBlock}>Listing Type</label>
                <select name="ListingType" value={formData.ListingType} onChange={handleChange} className={pageUi.input}>
                  {LISTING_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={pageUi.labelBlock} htmlFor="PropertyType">
                  Property Type <span className="text-rose-600 font-black">*</span>
                </label>
                <select
                  id="PropertyType"
                  name="PropertyType"
                  value={formData.PropertyType}
                  onChange={handleChange}
                  aria-required
                  aria-invalid={Boolean(fieldErrors.PropertyType)}
                  aria-describedby={fieldErrors.PropertyType ? 'PropertyType-error' : undefined}
                  className={controlClass('PropertyType')}
                >
                  <option value="">Select</option>
                  {PROPERTY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <FieldError field="PropertyType" />
              </div>
              <div>
                <label className={pageUi.labelBlock}>Configuration</label>
                <select name="Configuration" value={formData.Configuration} onChange={handleChange} className={pageUi.input}>
                  <option value="">Not applicable</option>
                  {CONFIGURATION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={pageUi.labelBlock} htmlFor="Location">
                  Location <span className="text-rose-600 font-black">*</span>
                </label>
                <input
                  id="Location"
                  type="text"
                  name="Location"
                  value={formData.Location}
                  onChange={handleChange}
                  placeholder="e.g. Khandwa Road Indore"
                  aria-required
                  aria-invalid={Boolean(fieldErrors.Location)}
                  aria-describedby={fieldErrors.Location ? 'Location-error' : undefined}
                  autoComplete="street-address"
                  className={controlClass('Location')}
                />
                <FieldError field="Location" />
              </div>
              <div className="md:col-span-2">
                <label className={pageUi.labelBlock}>Project Name (optional)</label>
                <input
                  type="text"
                  name="ProjectName"
                  value={formData.ProjectName}
                  onChange={handleChange}
                  placeholder="e.g. Neelanchal City (optional)"
                  className={pageUi.input}
                />
              </div>
              <div>
                <label className={pageUi.labelBlock}>Size</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="Size"
                  value={formData.Size}
                  onChange={handleChange}
                  placeholder="e.g. 1200"
                  className={pageUi.input}
                />
              </div>
              <div>
                <label className={pageUi.labelBlock}>Unit</label>
                <select name="SizeUnit" value={formData.SizeUnit} onChange={handleChange} className={pageUi.input}>
                  {SIZE_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Price (inline amount + denomination) ── */}
              <div className="md:col-span-2">
                <label className={pageUi.labelBlock} htmlFor="PriceAmount">Price</label>
                <div
                  className="flex items-stretch rounded-xl border border-slate-200 bg-white shadow-sm
                             hover:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20
                             transition-colors overflow-hidden"
                >
                  {/* Numeric amount */}
                  <input
                    id="PriceAmount"
                    type="number"
                    inputMode="decimal"
                    name="PriceAmount"
                    value={formData.PriceAmount}
                    onChange={handleChange}
                    placeholder="Enter amount"
                    min="0"
                    step="any"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-sm font-medium
                               text-slate-900 outline-none
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                               [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {/* Divider */}
                  <span className="w-px bg-slate-200 shrink-0" aria-hidden />
                  {/* Denomination selector */}
                  <select
                    name="PriceDenom"
                    value={formData.PriceDenom}
                    onChange={handleChange}
                    aria-label="Price denomination"
                    className="shrink-0 px-3 py-2.5 bg-slate-50 text-sm font-bold text-slate-700
                               outline-none cursor-pointer hover:bg-slate-100 transition-colors
                               border-l-0 appearance-none pr-7"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                  >
                    {PRICE_DENOM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Live preview */}
                {formData.PriceAmount && (() => {
                  const rupees = priceToRupees(formData.PriceAmount, formData.PriceDenom);
                  return rupees !== null ? (
                    <p className="mt-1.5 text-xs text-slate-500 ml-1">
                      ≈ ₹{rupees.toLocaleString('en-IN')}
                    </p>
                  ) : null;
                })()}
              </div>
              {/* Price Unit (Total / Per Sqft) */}

              <div>
                <label className={pageUi.labelBlock}>Facing</label>
                <select name="Facing" value={formData.Facing} onChange={handleChange} className={pageUi.input}>
                  {FACING_OPTIONS.map((f) => (
                    <option key={f} value={f === 'Not specified' ? '' : f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={pageUi.labelBlock}>Furnishing</label>
                <select name="Furnishing" value={formData.Furnishing} onChange={handleChange} className={pageUi.input}>
                  {FURNISHING_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={pageUi.labelBlock}>Road / Landmark</label>
                <input
                  type="text"
                  name="RoadLandmark"
                  value={formData.RoadLandmark}
                  onChange={handleChange}
                  placeholder="e.g. Corner Plot"
                  className={pageUi.input}
                />
              </div>
              <div className="md:col-span-2">
                <label className={pageUi.labelBlock}>Description</label>
                <textarea
                  name="Description"
                  value={formData.Description}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Original message or property description..."
                  className={pageUi.textarea}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
            <button type="button" onClick={handleReset} disabled={submitting} className={pageUi.btnSecondary}>
              <RotateCcw className="w-4 h-4" />
              Reset Form
            </button>
            <button type="submit" disabled={submitting} className={pageUi.btnPrimary}>
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting…' : 'Submit Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyPage;
