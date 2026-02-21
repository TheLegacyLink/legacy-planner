export const SPONSORSHIP_BOOKINGS_KEY = 'legacy-sponsorship-bookings-v1';

export function loadSponsorshipBookings() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SPONSORSHIP_BOOKINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSponsorshipBookings(list) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SPONSORSHIP_BOOKINGS_KEY, JSON.stringify(list));
}

export function upsertSponsorshipBooking(booking) {
  const list = loadSponsorshipBookings();
  const idx = list.findIndex((b) => b.id === booking.id);
  if (idx >= 0) {
    list[idx] = booking;
  } else {
    list.unshift(booking);
  }
  saveSponsorshipBookings(list);
  return list;
}
