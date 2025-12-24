// Format booking details for display
export function formatBookingDetails(booking, language = 'en') {
  const statusEmoji = {
    'pending': '⏳',
    'confirmed': '✅',
    'cancelled': '❌',
    'completed': '✔️'
  };
  
  const statusText = {
    'pending': language === 'hi' ? 'पेंडिंग' : 'Pending',
    'confirmed': language === 'hi' ? 'कन्फर्म' : 'Confirmed',
    'cancelled': language === 'hi' ? 'कैंसिल' : 'Cancelled',
    'completed': language === 'hi' ? 'पूर्ण' : 'Completed'
  };

  if (language === 'hi') {
    return `📋 *बुकिंग विवरण*

👤 नाम: ${booking.full_name}
📞 फोन: ${booking.phone}
📧 ईमेल: ${booking.email}
🛠️ सेवा: ${booking.service}
📅 तारीख: ${booking.preferred_date}
⏰ समय: ${booking.preferred_time}
${statusEmoji[booking.status] || '📌'} स्थिति: ${statusText[booking.status] || booking.status}
${booking.notes ? `📝 नोट्स: ${booking.notes}` : ''}`;
  }

  return `📋 *Booking Details*

👤 Name: ${booking.full_name}
📞 Phone: ${booking.phone}
📧 Email: ${booking.email}
🛠️ Service: ${booking.service}
📅 Date: ${booking.preferred_date}
⏰ Time: ${booking.preferred_time}
${statusEmoji[booking.status] || '📌'} Status: ${statusText[booking.status] || booking.status}
${booking.notes ? `📝 Notes: ${booking.notes}` : ''}`;
}

// Format short booking summary
export function formatBookingSummary(booking, language = 'en') {
  if (language === 'hi') {
    return `✅ बुकिंग:\n👤 ${booking.full_name}\n📅 ${booking.preferred_date}\n⏰ ${booking.preferred_time}\n📊 ${booking.status}`;
  }
  return `✅ Booking:\n👤 ${booking.full_name}\n📅 ${booking.preferred_date}\n⏰ ${booking.preferred_time}\n📊 ${booking.status}`;
}

