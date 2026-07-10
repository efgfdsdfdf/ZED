/*
  ZED Telemedicine API usage examples
  Keep this as a reference; wire into your real UI flows.
*/

const TELEMED_BASE = '/api/telemedicine';

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

export async function doctorSignupExample(payload) {
  const res = await fetch(`${TELEMED_BASE}/doctors/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchVerifiedDoctors() {
  const res = await fetch(`${TELEMED_BASE}/doctors`);
  return res.json();
}

export async function createBookingExample({ token, doctorId, scheduledTime }) {
  const res = await fetch(`${TELEMED_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      doctor_id: doctorId,
      scheduled_time: scheduledTime
    })
  });
  return res.json();
}

export async function payForBookingExample({ token, bookingId, paymentReference }) {
  const res = await fetch(`${TELEMED_BASE}/bookings/${bookingId}/pay`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      payment_reference: paymentReference // omit for mock mode
    })
  });
  return res.json();
}

export async function sendChatMessageExample({ token, bookingId, receiverId, message }) {
  const res = await fetch(`${TELEMED_BASE}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      booking_id: bookingId,
      receiver_id: receiverId,
      message
    })
  });
  return res.json();
}

export async function listChatMessagesExample({ token, bookingId }) {
  const res = await fetch(`${TELEMED_BASE}/messages/${bookingId}`, {
    headers: authHeaders(token)
  });
  return res.json();
}

/*
Realtime subscription example (browser):

const channel = supabase
  .channel('booking-chat')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `booking_id=eq.${bookingId}`
  }, payload => {
    console.log('New message:', payload.new);
  })
  .subscribe();
*/
