import React, { useState } from 'react';
import { Building, Calendar, Clock, MapPin, Users, X } from 'lucide-react';
import type { Amenity, BootstrapPayload } from '../types/society';
import { formatDateShort, formatINR, getStatusTextClass } from '../utils/format';
import { isSocietyManagement } from '../utils/permissions';

interface AmenitiesEventsViewProps {
  data: BootstrapPayload;
  onBookAmenity: (payload: {
    amenityId: string;
    date: string;
    slot: string;
    guests: number;
  }) => Promise<void>;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onRsvpEvent: (eventId: string, payload: { guests: number; volunteerRole?: string }) => Promise<void>;
}

export const AmenitiesEventsView: React.FC<AmenitiesEventsViewProps> = ({
  data,
  onBookAmenity,
  onCancelBooking,
  onRsvpEvent,
}) => {
  const [selectedAmenity, setSelectedAmenity] = useState<Amenity | null>(null);
  const [bookingDate, setBookingDate] = useState('2026-11-22');
  const [bookingSlot, setBookingSlot] = useState('');
  const [bookingGuests, setBookingGuests] = useState('2');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [volunteerText, setVolunteerText] = useState<Record<string, string>>({});

  const user = data.currentUser;
  const isManagement = isSocietyManagement(user);

  const openBookingModal = (amenity: Amenity) => {
    setErrorMsg(null);
    setSelectedAmenity(amenity);
    setBookingSlot(amenity.slots[0] ?? '');
    setBookingGuests(amenity.id === 'amn_clubhouse' ? '25' : '2');
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmenity) return;
    setErrorMsg(null);
    try {
      await onBookAmenity({
        amenityId: selectedAmenity.id,
        date: bookingDate,
        slot: bookingSlot,
        guests: Number(bookingGuests) || 1,
      });
      setSelectedAmenity(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete booking.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Amenities Catalogue */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Society Amenities &amp; Live Slot Booking
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real-time slot capacity with atomic conflict prevention and transparent cancellation/deposit refund rules.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.amenities.map((amn) => (
            <div
              key={amn.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {!failedImages[amn.id] ? (
                    <img
                      src={amn.imageUrl}
                      alt={amn.name}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedImages((prev) => ({ ...prev, [amn.id]: true }))}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 p-4 text-slate-600 dark:text-slate-300">
                      <Building className="h-8 w-8" />
                      <span className="mt-2 text-xs font-medium text-center">{amn.name}</span>
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Capacity {amn.capacity} · {amn.operatingHours}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-slate-900 dark:text-white">
                      {amn.name}
                    </h3>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p>
                      Fee: <strong className="font-mono-num text-slate-900 dark:text-white">{amn.fee === 0 ? 'Complimentary' : formatINR(amn.fee)}</strong>
                      {amn.deposit > 0 && ` · Deposit ${formatINR(amn.deposit)}`}
                    </p>
                    <p>{amn.accessibilityInfo}</p>
                    <ul className="list-disc pl-4 pt-1 space-y-0.5">
                      {amn.houseRules.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  type="button"
                  onClick={() => openBookingModal(amn)}
                  className="w-full min-h-[44px] rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 transition-colors"
                >
                  Check Availability &amp; Book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Active Bookings Table */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Confirmed &amp; Recent Facility Bookings
          </h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.bookings.map((b) => {
            const canCancel = b.status === 'confirmed' && (b.flatId === user.flatId || isManagement);
            return (
              <div key={b.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {b.amenityName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                    {formatDateShort(b.date)} · {b.slot} · {b.guests} guests · {b.flatNumber}
                  </p>
                  {b.refundStatus && (
                    <p className="mt-1 text-xs text-slate-500">{b.refundStatus}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs capitalize ${getStatusTextClass(b.status)}`}>
                    {b.status}
                  </span>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onCancelBooking(b.id)}
                      className="min-h-[38px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      Cancel Slot
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Community Events */}
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Community Events &amp; Workshops
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.events.map((evt) => {
            const myReg = evt.registrations.find((r) => r.flatNumber === user.flatNumber);
            const totalHeadcount = evt.registrations.reduce((s, r) => s + r.guests, 0);
            return (
              <div
                key={evt.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize font-medium text-teal-800 dark:text-teal-300">
                      {evt.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{evt.committeeApproved ? 'Committee Approved' : 'Pending Approval'}</span>
                  </div>
                  <h4 className="mt-1.5 font-display text-base font-semibold text-slate-900 dark:text-white">
                    {evt.title}
                  </h4>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {evt.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {formatDateShort(evt.date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {evt.time}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {evt.venue}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-num">
                      <Users className="h-3.5 w-3.5" /> {totalHeadcount}/{evt.capacity} registered
                    </span>
                  </div>
                </div>

                {user.flatNumber && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={volunteerText[evt.id] ?? myReg?.volunteerRole ?? ''}
                      onChange={(e) =>
                        setVolunteerText((prev) => ({ ...prev, [evt.id]: e.target.value }))
                      }
                      placeholder="Optional volunteer role (e.g. Gate Desk)"
                      className="min-h-[40px] flex-1 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onRsvpEvent(evt.id, {
                          guests: myReg?.guests ?? 2,
                          volunteerRole: volunteerText[evt.id],
                        })
                      }
                      className="min-h-[40px] rounded-lg bg-teal-800 px-4 text-xs font-medium text-white hover:bg-teal-900 whitespace-nowrap"
                    >
                      {myReg ? `Registered (${myReg.guests} guests) · Update` : 'RSVP (2 Guests)'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Booking Modal */}
      {selectedAmenity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleBookSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Book {selectedAmenity.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Max capacity {selectedAmenity.capacity} · Conflict check enforced on submit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAmenity(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Time Slot
              </label>
              <select
                value={bookingSlot}
                onChange={(e) => setBookingSlot(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {selectedAmenity.slots.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Expected Guests / Players
              </label>
              <input
                type="number"
                min={1}
                max={selectedAmenity.capacity}
                value={bookingGuests}
                onChange={(e) => setBookingGuests(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 px-3 text-sm font-mono-num dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedAmenity(null)}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-teal-800 px-5 text-sm font-medium text-white hover:bg-teal-900"
              >
                Confirm Booking
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
