import { getAppointments, createAppointment, cancelAppointment, getDoctors, getAvailability } from './api.js';

export async function renderAppointments(container) {
  if (!container) return;
  try {
    const data = await getAppointments();
    const appointments = data.appointments || data || [];
    container.innerHTML = '';

    if (!appointments.length) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3>Henuz randevunuz yok</h3>
          <p>WhatsApp uzerinden veya bu sayfadan yeni bir randevu alin.</p>
          <button class="btn btn-primary" onclick="window.dispatchEvent(new CustomEvent('open-book-modal'))">Randevu Al</button>
        </div>
      `;
      return;
    }

    appointments.forEach(apt => {
      const date = new Date(apt.date || apt.appointment_date);
      const day = date.getDate();
      const month = date.toLocaleString('tr-TR', { month: 'short' });
      const time = apt.time || (apt.appointment_time ? apt.appointment_time.slice(0, 5) : '');
      const status = (apt.status || 'pending').toLowerCase();
      const doctorName = apt.doctor_name || apt.doctor?.full_name || 'Bilinmeyen Doktor';
      const fullDate = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

      const card = document.createElement('div');
      card.className = 'appointment-card glass animate-fadeIn';
      card.innerHTML = `
        <div class="appointment-date-box">
          <div class="day">${day}</div>
          <div class="month">${month}</div>
        </div>
        <div class="appointment-info">
          <h4>${doctorName}</h4>
          <p>${fullDate}</p>
        </div>
        <div class="appointment-time">${time}</div>
        <span class="badge badge-${status}">${statusLabel(status)}</span>
        <div class="appointment-actions">
          ${status === 'pending' || status === 'confirmed' ? `<button class="btn btn-sm btn-danger" data-id="${apt.id || apt.appointment_id}">Iptal</button>` : ''}
        </div>
      `;
      container.appendChild(card);

      const cancelBtn = card.querySelector('.btn-danger');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (await cancelBooking(cancelBtn.dataset.id)) {
            renderAppointments(container);
          }
        });
      }
    });
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 40px;">Randevular yuklenirken hata: ${err.message}</p>`;
  }
}

function statusLabel(status) {
  const labels = {
    pending: 'Beklemede',
    confirmed: 'Onaylandi',
    cancelled: 'Iptal Edildi',
    completed: 'Tamamlandi',
  };
  return labels[status] || status;
}

export function showBookModal() {
  const overlay = document.getElementById('bookModal');
  if (!overlay) return;
  overlay.classList.add('open');
  loadDoctorsStep();
}

function hideBookModal() {
  const overlay = document.getElementById('bookModal');
  if (overlay) overlay.classList.remove('open');
}

let bookingState = { step: 1, doctorId: null, date: null, time: null, doctors: [] };

async function loadDoctorsStep() {
  const content = document.getElementById('modalContent');
  if (!content) return;
  content.innerHTML = '<div class="spinner"></div>';
  try {
    const data = await getDoctors();
    bookingState.doctors = data.doctors || data || [];
    bookingState.step = 1;
    renderStep1();
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">Doktorlar yuklenemedi: ${err.message}</p>`;
  }
}

function renderStep1() {
  const content = document.getElementById('modalContent');
  if (!content) return;
  updateIndicators(1);

  let html = '<label class="form-group"><label>Doktor Secin</label><select class="form-select" id="doctorSelect">';
  html += '<option value="">Doktor seciniz...</option>';
  bookingState.doctors.forEach(doc => {
    html += `<option value="${doc.id || doc.user_id}">${doc.full_name} - ${doc.specialty || 'Genel'}</option>`;
  });
  html += '</select></div>';
  html += '<button class="btn btn-primary form-submit" id="step1Next" disabled>Devam</button>';
  content.innerHTML = html;

  const select = document.getElementById('doctorSelect');
  const nextBtn = document.getElementById('step1Next');
  select.addEventListener('change', () => {
    bookingState.doctorId = select.value;
    nextBtn.disabled = !select.value;
  });
  nextBtn.addEventListener('click', () => {
    if (bookingState.doctorId) renderStep2();
  });
}

async function renderStep2() {
  const content = document.getElementById('modalContent');
  if (!content) return;
  updateIndicators(2);
  content.innerHTML = '<div class="spinner"></div>';

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let currentMonth = month;
  let currentYear = year;

  function renderCalendar() {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let html = `
      <div class="calendar-header">
        <button id="prevMonth">&larr;</button>
        <span style="font-weight:600">${new Date(currentYear, currentMonth).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}</span>
        <button id="nextMonth">&rarr;</button>
      </div>
      <div class="calendar-grid">
    `;
    const dayNames = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];
    dayNames.forEach(d => { html += `<div class="calendar-day-header">${d}</div>`; });

    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startOffset; i++) {
      html += '<div class="calendar-day other-month"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      const isToday = dateObj.getTime() === todayDate.getTime();
      const isPast = dateObj < todayDate;
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const classes = ['calendar-day'];
      if (isToday) classes.push('today');
      if (isPast) classes.push('unavailable');
      if (bookingState.date === dateStr) classes.push('selected');
      html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${d}</div>`;
    }

    html += '</div><button class="btn btn-primary form-submit" id="step2Next" style="margin-top:16px" disabled>Tarih Secin</button>';
    content.innerHTML = html;

    document.getElementById('prevMonth').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });
    document.getElementById('nextMonth').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });

    content.querySelectorAll('.calendar-day:not(.other-month):not(.unavailable)').forEach(el => {
      el.addEventListener('click', () => {
        content.querySelectorAll('.calendar-day.selected').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        bookingState.date = el.dataset.date;
        document.getElementById('step2Next').disabled = false;
      });
    });

    const nextBtn = document.getElementById('step2Next');
    if (bookingState.date) {
      const matching = content.querySelector(`[data-date="${bookingState.date}"]`);
      if (matching) { matching.classList.add('selected'); nextBtn.disabled = false; }
    }
    nextBtn.addEventListener('click', () => {
      if (bookingState.date) renderStep3();
    });
  }

  renderCalendar();
}

async function renderStep3() {
  const content = document.getElementById('modalContent');
  if (!content || !bookingState.doctorId || !bookingState.date) return;
  updateIndicators(3);
  content.innerHTML = '<div class="spinner"></div>';

  try {
    const data = await getAvailability(bookingState.doctorId, bookingState.date);
    const slots = data.slots || data.availableSlots || data || [];

    if (!slots.length) {
      content.innerHTML = `
        <p style="text-align:center;color:var(--text-muted);padding:40px">Bu tarihte uygun randevu bulunamadi.</p>
        <button class="btn btn-outline form-submit" onclick="loadDoctorsStep()">Geri Don</button>
      `;
      return;
    }

    let html = '<p style="margin-bottom:16px;color:var(--text-muted)">Müsait saatler:</p><div class="time-slots">';
    slots.forEach(slot => {
      const time = slot.time || slot.start_time || slot;
      const isBooked = slot.isBooked || slot.is_booked || false;
      html += `<div class="time-slot ${isBooked ? 'disabled' : ''}" data-time="${time}">${time.slice(0, 5)}</div>`;
    });
    html += '</div><button class="btn btn-primary form-submit" id="step3Confirm" style="margin-top:20px" disabled>Randevuyu Onayla</button>';

    content.innerHTML = html;

    content.querySelectorAll('.time-slot:not(.disabled)').forEach(el => {
      el.addEventListener('click', () => {
        content.querySelectorAll('.time-slot.selected').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        bookingState.time = el.dataset.time;
        document.getElementById('step3Confirm').disabled = false;
      });
    });

    document.getElementById('step3Confirm').addEventListener('click', async () => {
      if (bookingState.time) {
        await confirmBooking(bookingState.doctorId, bookingState.date, bookingState.time);
      }
    });
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">Saater yuklenemedi: ${err.message}</p>`;
  }
}

async function confirmBooking(doctorId, date, time) {
  const content = document.getElementById('modalContent');
  if (!content) return;
  content.innerHTML = '<div class="spinner"></div>';
  try {
    await createAppointment({ doctorId, date, time });
    content.innerHTML = `
      <div style="text-align:center;padding:40px">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" style="margin-bottom:16px">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h3 style="margin-bottom:8px">Randevunuz Olusturuldu</h3>
        <p style="color:var(--text-muted);margin-bottom:24px">Randevunuz basariyla olusturuldu. Onay bekleniyor.</p>
        <button class="btn btn-primary" onclick="location.reload()">Tamam</button>
      </div>
    `;
    bookingState = { step: 1, doctorId: null, date: null, time: null, doctors: bookingState.doctors };
    setTimeout(() => hideBookModal(), 3000);
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger);text-align:center;padding:20px">Hata: ${err.message}</p>
      <button class="btn btn-outline form-submit" onclick="loadDoctorsStep()">Tekrar Dene</button>`;
  }
}

export async function cancelBooking(id) {
  const confirmed = confirm('Randevuyu iptal etmek istediginize emin misiniz?');
  if (!confirmed) return false;
  try {
    await cancelAppointment(id);
    showToast('Randevu iptal edildi', 'success');
    return true;
  } catch (err) {
    showToast(err.message, 'error');
    return false;
  }
}

function updateIndicators(activeStep) {
  const indicators = document.querySelectorAll('.step-indicator');
  indicators.forEach((el, i) => {
    el.classList.remove('active', 'completed');
    if (i + 1 === activeStep) el.classList.add('active');
    else if (i + 1 < activeStep) el.classList.add('completed');
  });
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function setupBookModal() {
  const overlay = document.getElementById('bookModal');
  if (!overlay) return;

  const closeBtn = overlay.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideBookModal);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideBookModal();
  });

  window.addEventListener('open-book-modal', () => showBookModal());
}
